'use client';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export function cn(...inputs: (string | false | null | undefined)[]) {
  return twMerge(clsx(inputs));
}

// ── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-stone-300',
    secondary: 'bg-stone-800 text-white hover:bg-stone-900 disabled:bg-stone-300',
    ghost: 'bg-transparent text-stone-700 hover:bg-stone-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-stone-300',
    outline: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors cursor-pointer disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        styles[variant],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
      {props.children}
    </button>
  );
}

// ── Form controls ────────────────────────────────────────────────────────────

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400',
        'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-stone-100',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400',
        'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn('relative inline-block w-full', className)}>
      <select
        className={cn(
          'w-full appearance-none rounded-md border border-stone-300 bg-white py-2 pl-3 pr-9 text-sm',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-stone-100',
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn('mb-1 block text-xs font-medium text-stone-600', className)}>{children}</label>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-stone-400">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
      <input type="checkbox" className="h-4 w-4 rounded border-stone-300 accent-[#9a5224]" {...props} />
      {label}
    </label>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-stone-100 text-stone-600',
  purple: 'bg-purple-100 text-purple-800',
};

export function Badge({ color = 'gray', children }: { color?: keyof typeof BADGE_COLORS; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', BADGE_COLORS[color])}>
      {children}
    </span>
  );
}

export function statusColor(status: string): keyof typeof BADGE_COLORS {
  const map: Record<string, keyof typeof BADGE_COLORS> = {
    DRAFT: 'gray', PENDING_PAYMENT: 'amber', CONFIRMED: 'blue', PROCESSING: 'purple',
    PARTIALLY_SHIPPED: 'purple', SHIPPED: 'blue', DELIVERED: 'green', COMPLETED: 'green',
    CANCELLED: 'red', REFUNDED: 'red', DELIVERY_FAILED: 'red',
    UNPAID: 'amber', PARTIALLY_PAID: 'amber', PAID: 'green', REFUND_PENDING: 'amber',
    PARTIALLY_REFUNDED: 'amber',
    active: 'green', draft: 'gray', archived: 'gray', scheduled: 'blue', paused: 'amber',
    ended: 'gray', published: 'green', invited: 'amber', deactivated: 'red',
    pending: 'amber', approved: 'blue', processed: 'green', rejected: 'red', failed: 'red',
    out: 'blue', delivered: 'green', counting: 'amber', review: 'blue',
    REQUESTED: 'amber', APPROVED: 'blue', RECEIVED: 'purple', RESOLVED: 'green', REJECTED: 'red',
    verified: 'green', flagged: 'red', low_confidence: 'amber',
    blocked: 'red', pod_blocked: 'red', watch: 'amber',
  };
  return map[status] ?? 'gray';
}

// ── Card ─────────────────────────────────────────────────────────────────────

export function Card({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-stone-200 bg-white shadow-sm', className)}>
      {title != null && (
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

export function Table({ headers, children, empty }: { headers: React.ReactNode[]; children: React.ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {hasRows ? children : (
            <tr>
              <td colSpan={headers.length} className="px-3 py-10 text-center text-sm text-stone-400">
                {empty ?? 'Nothing here yet'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2.5 align-middle', className)}>{children}</td>;
}

// ── Dialog ───────────────────────────────────────────────────────────────────

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]" onClick={onClose}>
      <div
        className={cn('w-full rounded-xl bg-white shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-stone-400 hover:bg-stone-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: React.ReactNode }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-stone-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
            active === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-800',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Misc ─────────────────────────────────────────────────────────────────────

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="mb-2 inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900">
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 15l-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </a>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-stone-900">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-stone-200 border-t-brand-600" />
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const err = error as { message?: string; errors?: { message: string }[] };
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <p>{err.message ?? 'Something went wrong'}</p>
      {err.errors?.length ? (
        <ul className="mt-1 list-inside list-disc text-xs">
          {err.errors.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-stone-500">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
