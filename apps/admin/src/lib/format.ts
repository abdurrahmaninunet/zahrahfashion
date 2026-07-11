/**
 * Kobo → ₦ display. All API money is integer kobo.
 * Negatives render −₦380,000; with `signed`, positives render +₦380,000
 * (for variance/delta contexts — plain prices stay unsigned).
 */
export function naira(kobo: number | null | undefined, opts?: { compact?: boolean; signed?: boolean }): string {
  if (kobo == null) return '—';
  const sign = kobo < 0 ? '−' : opts?.signed && kobo > 0 ? '+' : '';
  const value = Math.abs(kobo) / 100;
  if (opts?.compact && value >= 1_000_000) {
    return `${sign}₦${(value / 1_000_000).toFixed(1)}M`;
  }
  if (opts?.compact && value >= 10_000) {
    return `${sign}₦${(value / 1_000).toFixed(0)}k`;
  }
  return `${sign}₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export function nairaInput(kobo: number | null | undefined): string {
  return kobo == null ? '' : String(kobo / 100);
}

export function toKobo(nairaStr: string | number): number {
  return Math.round(Number(nairaStr) * 100);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const ms = Date.now() - new Date(d).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function qty(value: unknown): string {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}
