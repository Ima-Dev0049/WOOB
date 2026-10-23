import { cookies } from 'next/headers';
import { normalizeUiLocale, type UiLocale } from '@/lib/i18n';

export const UI_LOCALE_COOKIE = 'woob_locale';

export async function getRequestUiLocale(): Promise<UiLocale> {
  const store = await cookies();
  return normalizeUiLocale(store.get(UI_LOCALE_COOKIE)?.value);
}
