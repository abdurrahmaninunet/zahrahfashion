'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { naira, formatDate, qty } from '@/lib/format';
import { BackLink, Button, Spinner } from '@/components/ui';

interface InvoiceData {
  store: Record<string, string>;
  order: {
    orderNumber: string; createdAt: string; paymentStatus: string;
    subtotal: number; discountTotal: number; shippingFee: number; grandTotal: number;
    customer: { fullName: string; primaryPhone: string } | null;
    address: { line?: string; addressLine?: string; area?: string; city?: string } | null;
    lines: { id: string; productNameSnapshot: string; unitSnapshot: string; unitPriceSnapshot: number; quantity: string; lineTotal: number }[];
  };
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<InvoiceData>(`/orders/${id}/invoice`),
  });

  if (isLoading || !data) return <Spinner />;
  const { store, order } = data;

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <BackLink href={`/orders/${id}`} label="Back to order" />
        <Button onClick={() => window.print()}>Print / Save PDF</Button>
      </div>
      <div className="border border-stone-200 p-8 print:border-0">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{String(store['store.name'] ?? 'Zahra Fashion')}</h1>
            <p className="text-sm text-stone-500">{String(store['store.address'] ?? '')}</p>
            <p className="text-sm text-stone-500">{String(store['store.phone'] ?? '')} {String(store['store.email'] ?? '')}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">INVOICE</p>
            <p className="text-sm">{order.orderNumber}</p>
            <p className="text-sm text-stone-500">{formatDate(order.createdAt)}</p>
            <p className="mt-1 text-sm font-semibold">{order.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID'}</p>
          </div>
        </div>
        <div className="mb-6 text-sm">
          <p className="font-semibold">Billed to</p>
          <p>{order.customer?.fullName}</p>
          <p className="text-stone-500">{order.customer?.primaryPhone}</p>
          <p className="text-stone-500">{order.address?.line ?? order.address?.addressLine} {order.address?.area}</p>
        </div>
        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-stone-800 text-left">
              <th className="py-2">Item</th><th className="py-2">Qty</th><th className="py-2 text-right">Unit price</th><th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2">{line.productNameSnapshot}</td>
                <td>{qty(line.quantity)} {line.unitSnapshot}</td>
                <td className="text-right">{naira(line.unitPriceSnapshot)}</td>
                <td className="text-right">{naira(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{naira(order.subtotal)}</span></div>
          {order.discountTotal > 0 && <div className="flex justify-between"><span>Discount</span><span>−{naira(order.discountTotal)}</span></div>}
          <div className="flex justify-between"><span>Delivery</span><span>{naira(order.shippingFee)}</span></div>
          <div className="flex justify-between border-t-2 border-stone-800 pt-1 text-base font-bold"><span>Total</span><span>{naira(order.grandTotal)}</span></div>
        </div>
        <p className="mt-8 text-center text-xs text-stone-400">Thank you for shopping with {String(store['store.name'] ?? 'us')}!</p>
      </div>
    </div>
  );
}
