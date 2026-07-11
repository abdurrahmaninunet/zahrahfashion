export function naira(kobo: number | null | undefined): string {
  if (kobo == null) return '';
  const sign = kobo < 0 ? '−' : '';
  return `${sign}₦${(Math.abs(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export function qty(value: unknown): string {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function endsIn(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.floor(ms / 60_000)}m left`;
  if (hours < 48) return `${hours}h left`;
  return `${Math.floor(hours / 24)} days left`;
}

/** WhatsApp deep link with prefilled context (S-BR-11). */
export function whatsappLink(number: string, message: string): string {
  const digits = number.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
