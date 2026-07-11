'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Image as KImage, Text, TextPath, Transformer } from 'react-konva';
import type Konva from 'konva';
import { Check, ImagePlus, Loader2, Trash2, Type as TypeIcon } from 'lucide-react';

/** Bundled starter fonts — web-safe stacks so canvas renders them without any
 *  network font load, and the exported PNG bakes the glyphs in. */
const FONTS = [
  { label: 'Sans', value: 'Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Script', value: '"Brush Script MT", "Segoe Script", cursive' },
  { label: 'Display', value: 'Impact, Haettenschweiler, sans-serif' },
  { label: 'Rounded', value: '"Trebuchet MS", "Comic Sans MS", sans-serif' },
];
const COLORS = ['#111111', '#ffffff', '#e11d48', '#2563eb', '#059669', '#f59e0b', '#7c3aed', '#78350f'];
const DEFAULT_AREA = { x: 0.24, y: 0.2, width: 0.52, height: 0.52 };

export interface DesignElement {
  id: string;
  type: 'text' | 'image';
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  text?: string; fontFamily?: string; fontSize?: number; fill?: string; curve?: number;
  src?: string; width?: number; height?: number;
}
export interface DesignSide {
  id: string; label: string; stage: number;
  printArea: { x: number; y: number; width: number; height: number };
  elements: DesignElement[]; previewUrl?: string;
}
export interface DesignSpec { sides: DesignSide[] }

interface SideConfig { id: string; label: string; image: string | null; printArea: { x: number; y: number; width: number; height: number } | null }

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new window.Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

function useHtmlImage(src: string | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    let alive = true;
    loadImg(src).then((i) => { if (alive) setImg(i); });
    return () => { alive = false; };
  }, [src]);
  return img;
}

/** Circular-arc path centred on (0,0) for curved text. curve: -100..100
 *  (positive = rainbow arch upward, negative = valley), vertically centred. */
function arcData(width: number, curve: number) {
  const c = Math.max(-100, Math.min(100, curve));
  if (Math.abs(c) < 2) return `M ${-width / 2} 0 L ${width / 2} 0`;
  const angle = (Math.abs(c) / 100) * Math.PI * 0.85;
  const r = (width / 2) / Math.sin(angle / 2);
  const sagitta = r - Math.sqrt(Math.max(0, r * r - (width / 2) * (width / 2)));
  const up = c > 0;
  const y0 = up ? sagitta / 2 : -sagitta / 2;
  const sweep = up ? 1 : 0;
  return `M ${-width / 2} ${y0} A ${r} ${r} 0 0 ${sweep} ${width / 2} ${y0}`;
}

let idc = 0;
const newId = () => `el_${++idc}`;

async function uploadImage(dataUrlOrBlob: string | Blob, filename: string): Promise<string> {
  const blob = typeof dataUrlOrBlob === 'string' ? await (await fetch(dataUrlOrBlob)).blob() : dataUrlOrBlob;
  const form = new FormData();
  form.append('file', blob, filename);
  const res = await fetch('/api/store/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  const json = (await res.json()) as { url: string };
  return json.url;
}

export default function DesignEditor({ productName, sides, initial, onSave }: {
  productName: string;
  /** One or more sides (front/back/…), each with its image + print area. */
  sides: SideConfig[];
  initial: DesignSpec | null;
  onSave: (result: { spec: DesignSpec; previewUrl: string; text: string }) => Promise<void> | void;
}) {
  const safeSides = sides.length ? sides : [{ id: 'front', label: 'Front', image: null, printArea: null }];
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState(360);
  const [activeId, setActiveId] = useState(safeSides[0].id);
  const [elementsBySide, setElementsBySide] = useState<Record<string, DesignElement[]>>(() => {
    const m: Record<string, DesignElement[]> = {};
    safeSides.forEach((s) => { m[s.id] = []; });
    return m;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [bgCache, setBgCache] = useState<Record<string, HTMLImageElement>>({});

  const active = safeSides.find((s) => s.id === activeId) ?? safeSides[0];
  const elements = elementsBySide[active.id] ?? [];
  const af = active.printArea ?? DEFAULT_AREA;
  const printArea = { x: size * af.x, y: size * af.y, width: size * af.width, height: size * af.height };
  const bg = active.image ? bgCache[active.image] ?? null : null;

  // Preload every side's background so switching + export is instant.
  useEffect(() => {
    let alive = true;
    const urls = Array.from(new Set(safeSides.map((s) => s.image).filter(Boolean))) as string[];
    Promise.all(urls.map((u) => loadImg(u))).then((imgs) => {
      if (!alive) return;
      const m: Record<string, HTMLImageElement> = {};
      urls.forEach((u, i) => { if (imgs[i]) m[u] = imgs[i]!; });
      setBgCache(m);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Measure the stage to the container width (square), capped.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize(Math.min(520, Math.max(280, el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load an initial design (per side, rescaled from its authored size).
  useEffect(() => {
    if (!initial?.sides) return;
    const m: Record<string, DesignElement[]> = {};
    safeSides.forEach((s) => { m[s.id] = []; });
    initial.sides.forEach((is) => {
      const f = size / (is.stage || size);
      m[is.id] = is.elements.map((e) => ({
        ...e, x: e.x * f, y: e.y * f,
        fontSize: e.fontSize ? e.fontSize * f : e.fontSize,
        width: e.width ? e.width * f : e.width,
        height: e.height ? e.height * f : e.height,
      }));
    });
    setElementsBySide(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // Bind the transformer to the selected node.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selectedId ? stage.findOne(`#${selectedId}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements, activeId]);

  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const setElements = (updater: (els: DesignElement[]) => DesignElement[]) =>
    setElementsBySide((all) => ({ ...all, [active.id]: updater(all[active.id] ?? []) }));
  const patch = (id: string, p: Partial<DesignElement>) => setElements((els) => els.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const remove = (id: string) => { setElements((els) => els.filter((e) => e.id !== id)); setSelectedId(null); };

  function addText() {
    const t = draftText.trim() || 'Your text';
    const el: DesignElement = {
      id: newId(), type: 'text', text: t, x: size / 2, y: printArea.y + printArea.height / 2,
      rotation: 0, scaleX: 1, scaleY: 1, fontFamily: FONTS[0].value, fontSize: Math.round(size * 0.08), fill: COLORS[0], curve: 0,
    };
    setElements((els) => [...els, el]);
    setSelectedId(el.id);
    setDraftText('');
  }

  async function pickImage(file: File) {
    const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
    let src = dataUrl;
    try { src = await uploadImage(file, file.name); } catch { /* fall back to inline data URL */ }
    const img = await loadImg(src);
    if (!img) return;
    const w = printArea.width * 0.6;
    const h = w * (img.height / img.width);
    const el: DesignElement = {
      id: newId(), type: 'image', src, x: size / 2, y: printArea.y + printArea.height / 2,
      rotation: 0, scaleX: 1, scaleY: 1, width: w, height: h,
    };
    setElements((els) => [...els, el]);
    setSelectedId(el.id);
  }

  const anyElements = safeSides.some((s) => (elementsBySide[s.id] ?? []).length > 0);

  async function handleSave() {
    setSelectedId(null);
    setSaving(true);
    const prevActive = activeId;
    const out: DesignSide[] = [];
    try {
      for (const s of safeSides) {
        const els = elementsBySide[s.id] ?? [];
        if (!els.length) continue;
        setActiveId(s.id);
        await new Promise((r) => setTimeout(r, 220)); // let the side render
        const dataUrl = stageRef.current!.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
        let previewUrl = dataUrl;
        try { previewUrl = await uploadImage(dataUrl, `${productName.replace(/\W+/g, '-')}-${s.id}.png`); } catch { /* keep data URL */ }
        const pa = s.printArea ?? DEFAULT_AREA;
        out.push({ id: s.id, label: s.label, stage: size, printArea: { x: size * pa.x, y: size * pa.y, width: size * pa.width, height: size * pa.height }, elements: els, previewUrl });
      }
      setActiveId(prevActive);
      if (!out.length) return;
      const text = out.flatMap((s) => s.elements.filter((e) => e.type === 'text').map((e) => e.text)).filter(Boolean).join(' · ');
      await onSave({ spec: { sides: out }, previewUrl: out[0].previewUrl ?? '', text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Canvas */}
      <div className="lg:flex-1">
        {/* Side switcher */}
        {safeSides.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {safeSides.map((s) => {
              const count = (elementsBySide[s.id] ?? []).length;
              return (
                <button key={s.id} type="button" onClick={() => { setActiveId(s.id); setSelectedId(null); }}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium cursor-pointer ${active.id === s.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'}`}>
                  {s.label}
                  {count > 0 && <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${active.id === s.id ? 'bg-white text-stone-900' : 'bg-[#8a6d1f] text-white'}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        )}
        <div ref={wrapRef} className="mx-auto w-full max-w-[520px]">
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50" style={{ width: size, height: size, margin: '0 auto' }}>
            <Stage
              ref={stageRef}
              width={size}
              height={size}
              onMouseDown={(e) => { if (e.target === e.target.getStage() || e.target.name() === 'bg') setSelectedId(null); }}
              onTouchStart={(e) => { if (e.target === e.target.getStage() || e.target.name() === 'bg') setSelectedId(null); }}
            >
              <Layer>
                {bg && <KImage image={bg} name="bg" width={size} height={size} listening />}
                <Rect x={printArea.x} y={printArea.y} width={printArea.width} height={printArea.height} stroke="#8a6d1f" dash={[6, 5]} strokeWidth={1} listening={false} />
                <Group clipX={printArea.x} clipY={printArea.y} clipWidth={printArea.width} clipHeight={printArea.height}>
                  {elements.map((el) => el.type === 'text' ? (
                    (el.curve ?? 0) !== 0 ? (
                      <TextPath
                        key={el.id} id={el.id} text={el.text} fill={el.fill} fontFamily={el.fontFamily} fontSize={el.fontSize}
                        data={arcData((el.text?.length ?? 1) * (el.fontSize ?? 20) * 0.6, el.curve ?? 0)} align="center"
                        x={el.x} y={el.y} rotation={el.rotation} scaleX={el.scaleX} scaleY={el.scaleY} draggable
                        onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                        onDragEnd={(e) => patch(el.id, { x: e.target.x(), y: e.target.y() })}
                        onTransformEnd={(e) => patch(el.id, { x: e.target.x(), y: e.target.y(), rotation: e.target.rotation(), scaleX: e.target.scaleX(), scaleY: e.target.scaleY() })}
                      />
                    ) : (
                      <Text
                        key={el.id} id={el.id} text={el.text} fill={el.fill} fontFamily={el.fontFamily} fontSize={el.fontSize}
                        x={el.x} y={el.y} rotation={el.rotation} scaleX={el.scaleX} scaleY={el.scaleY} draggable
                        ref={(node) => { if (node) node.offsetX(node.width() / 2), node.offsetY(node.height() / 2); }}
                        onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                        onDragEnd={(e) => patch(el.id, { x: e.target.x(), y: e.target.y() })}
                        onTransformEnd={(e) => patch(el.id, { x: e.target.x(), y: e.target.y(), rotation: e.target.rotation(), scaleX: e.target.scaleX(), scaleY: e.target.scaleY() })}
                      />
                    )
                  ) : (
                    <ImageEl key={el.id} el={el} onSelect={() => setSelectedId(el.id)} onChange={(p) => patch(el.id, p)} />
                  ))}
                </Group>
                <Transformer ref={trRef} rotateEnabled keepRatio={false} anchorSize={9} borderStroke="#8a6d1f" anchorStroke="#8a6d1f"
                  boundBoxFunc={(oldB, newB) => (newB.width < 12 || newB.height < 12 ? oldB : newB)} />
              </Layer>
            </Stage>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="lg:w-72 lg:shrink-0">
        <div className="flex gap-2">
          <input
            value={draftText} onChange={(e) => setDraftText(e.target.value)} maxLength={40} placeholder="Type text to print…"
            onKeyDown={(e) => { if (e.key === 'Enter') addText(); }}
            className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900"
          />
          <button type="button" onClick={addText} className="flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-sm font-medium text-white hover:bg-stone-800 cursor-pointer">
            <TypeIcon size={15} /> Add
          </button>
        </div>
        <label className="mt-2 flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-stone-300 text-sm font-medium text-stone-600 hover:border-stone-500">
          <ImagePlus size={15} /> Upload image / logo
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ''; }} />
        </label>
        {safeSides.length > 1 && <p className="mt-2 text-center text-[11px] text-stone-400">Editing the <b>{active.label}</b> side.</p>}

        {selected ? (
          <div className="mt-4 space-y-3 rounded-lg border border-stone-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">{selected.type === 'text' ? 'Text' : 'Image'}</span>
              <button type="button" onClick={() => remove(selected.id)} aria-label="Delete" className="text-stone-400 hover:text-red-600 cursor-pointer"><Trash2 size={15} /></button>
            </div>

            {selected.type === 'text' && (
              <>
                <input value={selected.text ?? ''} onChange={(e) => patch(selected.id, { text: e.target.value })} maxLength={40}
                  className="h-9 w-full rounded-md border border-stone-300 px-2.5 text-sm outline-none focus:border-stone-900" />
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Font</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FONTS.map((f) => (
                      <button key={f.value} type="button" onClick={() => patch(selected.id, { fontFamily: f.value })}
                        style={{ fontFamily: f.value }}
                        className={`rounded-md border px-2 py-1.5 text-sm cursor-pointer ${selected.fontFamily === f.value ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 hover:border-stone-500'}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Size</p>
                  <input type="range" min={12} max={Math.round(size * 0.22)} value={selected.fontSize ?? 20}
                    onChange={(e) => patch(selected.id, { fontSize: Number(e.target.value) })} className="w-full accent-[#8a6d1f]" />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Curve</p>
                  <input type="range" min={-100} max={100} value={selected.curve ?? 0}
                    onChange={(e) => patch(selected.id, { curve: Number(e.target.value) })} className="w-full accent-[#8a6d1f]" />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Colour</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {COLORS.map((c) => (
                      <button key={c} type="button" aria-label={c} onClick={() => patch(selected.id, { fill: c })}
                        className={`h-6 w-6 rounded-full border ${selected.fill === c ? 'ring-2 ring-stone-900 ring-offset-1' : 'border-stone-300'}`} style={{ background: c }} />
                    ))}
                    <input type="color" value={selected.fill ?? '#111111'} onChange={(e) => patch(selected.id, { fill: e.target.value })}
                      className="h-6 w-6 cursor-pointer rounded-full border border-stone-300 bg-transparent p-0" />
                  </div>
                </div>
              </>
            )}
            {selected.type === 'image' && (
              <p className="text-xs leading-relaxed text-stone-500">Drag to move, use the corner handles to resize or rotate.</p>
            )}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-stone-200 px-3 py-4 text-center text-xs text-stone-400">
            Add text or an image, then tap it on the product to style, move, resize or rotate it.
          </p>
        )}

        <div className="mt-4">
          <button type="button" onClick={handleSave} disabled={saving || !anyElements}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50 cursor-pointer">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Check size={16} /> Save design</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Image element with its own loaded HTMLImage. */
function ImageEl({ el, onSelect, onChange }: { el: DesignElement; onSelect: () => void; onChange: (p: Partial<DesignElement>) => void }) {
  const img = useHtmlImage(el.src);
  if (!img) return null;
  return (
    <KImage
      id={el.id} image={img} width={el.width} height={el.height}
      x={el.x} y={el.y} rotation={el.rotation} scaleX={el.scaleX} scaleY={el.scaleY}
      offsetX={(el.width ?? 0) / 2} offsetY={(el.height ?? 0) / 2} draggable
      onClick={onSelect} onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => onChange({ x: e.target.x(), y: e.target.y(), rotation: e.target.rotation(), scaleX: e.target.scaleX(), scaleY: e.target.scaleY() })}
    />
  );
}
