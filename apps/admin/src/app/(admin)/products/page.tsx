'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, qty } from '@/lib/format';
import { Badge, Button, Input, PageHeader, Pagination, Select, Spinner, statusColor } from '@/components/ui';

interface ProductRow {
  id: string; name: string; slug: string; type: string; status: string; visibility: string;
  category: { id: string; name: string }; variantCount: number;
  priceMin: number | null; priceMax: number | null; totalStock: number; cover: string | null;
  wholeItem: boolean; hasFormats: boolean;
}
interface Category { id: string; name: string; parentId: string | null }

function ProductsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { hasCap } = useAuth();
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [stock, setStock] = useState(params.get('stock') ?? '');
  const [page, setPage] = useState(1);

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });

  // Tree-ordered options: each root followed by its children, mirroring the
  // Categories screen's positioning.
  const categoryOptions = (() => {
    if (!categories) return [];
    const roots = categories.filter((c) => !c.parentId);
    return roots.flatMap((root) => [
      { id: root.id, label: root.name },
      ...categories.filter((c) => c.parentId === root.id).map((child) => ({ id: child.id, label: `  — ${child.name}` })),
    ]);
  })();
  const query = new URLSearchParams({
    ...(q ? { q } : {}), ...(categoryId ? { categoryId } : {}),
    ...(status ? { status } : {}), ...(stock ? { stock } : {}), page: String(page),
  });
  const { data, isLoading } = useQuery({
    queryKey: ['products', query.toString()],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; rows: ProductRow[] }>(`/products?${query}`),
  });

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <PageHeader
        title="Products"
        action={
          <div className="flex gap-2">
            {hasCap('products.manage_categories') && (
              <Link href="/products/taxonomy"><Button variant="outline"><SlidersHorizontal size={15} /> Categories & attributes</Button></Link>
            )}
            {hasCap('products.create_edit') && <Link href="/products/new"><Button><Plus size={15} /> Add product</Button></Link>}
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Input placeholder="Search name or SKU…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="max-w-xs" />
        <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="w-48">
          <option value="">All categories</option>
          {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-32">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
        <Select value={stock} onChange={(e) => { setStock(e.target.value); setPage(1); }} className="w-36">
          <option value="">Any stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </Select>
      </div>

      {isLoading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data?.rows.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/products/${p.id}`)}
                className="group overflow-hidden rounded-lg border border-stone-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md cursor-pointer"
              >
                <div className="relative aspect-square overflow-hidden bg-stone-100">
                  {p.cover ? (
                    <img src={p.cover} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-stone-200">
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                    {p.status !== 'active' && <Badge color={statusColor(p.status)}>{p.status}</Badge>}
                    {p.type !== 'standard' && <Badge color="purple">bundle</Badge>}
                    {p.hasFormats ? <Badge color="blue">formats</Badge> : p.wholeItem && <Badge color="green">whole item</Badge>}
                    {p.visibility === 'hidden' && <Badge>hidden</Badge>}
                  </div>
                  {p.totalStock <= 0 && (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">OUT OF STOCK</span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-medium" title={p.name}>{p.name}</p>
                  <p className="truncate text-[11px] text-stone-400">{p.category.name}{p.variantCount > 1 ? ` · ${p.variantCount} variants` : ''}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {p.priceMin == null ? '—' : p.priceMin === p.priceMax ? naira(p.priceMin) : `${naira(p.priceMin, { compact: true })}+`}
                    </span>
                    <span className={`text-xs ${p.totalStock <= 0 ? 'font-bold text-red-600' : 'text-stone-500'}`}>
                      {qty(p.totalStock)} in stock
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {!data?.rows.length && <p className="py-16 text-center text-sm text-stone-400">No products match</p>}
          {data && <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
        </>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return <Suspense fallback={<Spinner />}><ProductsPageInner /></Suspense>;
}
