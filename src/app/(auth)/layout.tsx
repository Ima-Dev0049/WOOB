import { Logo } from '@/components/ui/Logo';
import { MotionSurface } from '@/components/ui/MotionSurface';
import { getDictionary } from '@/lib/i18n';
import { getRequestUiLocale } from '@/server/locale';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestUiLocale();
  const dict = getDictionary(locale);
  return <MotionSurface motionKey={`auth-${locale}`}><main className="auth-layout" lang={locale}><aside className="auth-aside" data-surface-reveal="fade"><Logo inverse /><div><span className="eyebrow">{dict.auth.creativeSpace}</span><blockquote>{dict.auth.quote}</blockquote><p>{dict.auth.asideBody}</p></div><small>{dict.auth.asideFooter}</small></aside><section className="auth-main" data-surface-reveal="rise" data-surface-order="1"><div className="auth-mobile-logo"><Logo /></div>{children}</section></main></MotionSurface>;
}
