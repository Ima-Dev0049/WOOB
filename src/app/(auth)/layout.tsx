import { Logo } from '@/components/ui/Logo';
import { getDictionary } from '@/lib/i18n';
import { getRequestUiLocale } from '@/server/locale';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestUiLocale();
  const dict = getDictionary(locale);
  return <main className="auth-layout" lang={locale}><aside className="auth-aside"><Logo inverse /><div><span className="eyebrow">{dict.auth.creativeSpace}</span><blockquote>{dict.auth.quote}</blockquote><p>{dict.auth.asideBody}</p></div><small>{dict.auth.asideFooter}</small></aside><section className="auth-main"><div className="auth-mobile-logo"><Logo /></div>{children}</section></main>;
}
