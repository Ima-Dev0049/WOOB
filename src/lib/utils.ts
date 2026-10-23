export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 58) || 'site';
}

export function normalizePagePath(value: string): string {
  const slug = slugify(value);
  return `/${slug}`;
}

export function formatMoney(cents: number, currency = 'EUR', locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export function formatDate(value: Date | string | null, locale = 'fr-FR'): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
}

export function truncate(value: string, length = 120): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function absoluteAppUrl(path = ''): string {
  const base = process.env.APP_URL || 'http://localhost:3000';
  return new URL(path, base).toString();
}

export function currentPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
