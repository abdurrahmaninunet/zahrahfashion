'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card, Dialog, ErrorNote, Field, Input, PageHeader, Spinner } from '@/components/ui';

interface Collection { id: string; name: string; slug: string }

/** Manage product collections — named groupings assigned to products (via the
 *  product editor's Collection dropdown) and surfaced on the storefront. */
export default function CollectionsPage() {
  const queryClient = useQueryClient();
  const { hasCap } = useAuth();
  const canEdit = hasCap('products.manage_categories');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Collection | null>(null);
  const [removing, setRemoving] = useState<Collection | null>(null);
  const [error, setError] = useState<unknown>(null);

  const { data, isLoading } = useQuery({ queryKey: ['collections'], queryFn: () => api.get<Collection[]>('/collections') });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['collections'] });

  const create = useMutation({
    mutationFn: () => api.post('/collections', { name: name.trim() }),
    onSuccess: () => { setName(''); invalidate(); },
    onError: setError,
  });
  const rename = useMutation({
    mutationFn: (c: Collection) => api.put(`/collections/${c.id}`, { name: c.name.trim() }),
    onSuccess: () => { setEditing(null); invalidate(); },
    onError: setError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/collections/${id}`),
    onSuccess: () => { setRemoving(null); invalidate(); },
    onError: (e) => { setRemoving(null); setError(e); },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Collections" subtitle="Named groupings you assign to products (in the product editor) and shop by on the storefront." />

      <ErrorNote error={error} />

      {canEdit && (
        <Card>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}
          >
            <div className="flex-1">
              <Field label="New collection"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bridal, Eid Edit, Owambe" /></Field>
            </div>
            <Button type="submit" disabled={!name.trim() || create.isPending}><Plus size={15} /> Add</Button>
          </form>
        </Card>
      )}

      <div className="mt-4">
        {isLoading || !data ? <Spinner /> : data.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 py-10 text-center text-sm text-stone-400">
            No collections yet — add one above, then assign products to it in the product editor.
          </p>
        ) : (
          <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {data.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-4 py-3">
                {editing?.id === c.id ? (
                  <>
                    <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="flex-1" />
                    <button aria-label="Save" className="text-emerald-600 hover:text-emerald-700 cursor-pointer" onClick={() => rename.mutate(editing)}><Check size={16} /></button>
                    <button aria-label="Cancel" className="text-stone-400 hover:text-stone-700 cursor-pointer" onClick={() => setEditing(null)}><X size={16} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-stone-800">{c.name}</span>
                    <span className="text-xs text-stone-400">/{c.slug}</span>
                    {canEdit && (
                      <>
                        <button aria-label={`Rename ${c.name}`} className="text-stone-400 hover:text-stone-700 cursor-pointer" onClick={() => setEditing(c)}><Pencil size={15} /></button>
                        <button aria-label={`Delete ${c.name}`} className="text-stone-400 hover:text-red-600 cursor-pointer" onClick={() => setRemoving(c)}><Trash2 size={15} /></button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {removing && (
        <Dialog open onClose={() => setRemoving(null)} title="Delete collection">
          <div className="space-y-4">
            <p className="text-sm text-stone-600">Delete the collection <b>{removing.name}</b>? Products assigned to it stay, but lose this grouping.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(removing.id)}>Delete</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
