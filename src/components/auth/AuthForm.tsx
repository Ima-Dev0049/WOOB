'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDictionary, type UiLocale } from '@/lib/i18n';

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

export function AuthForm({ mode, token = '', locale = 'fr' }: { mode: Mode; token?: string; locale?: UiLocale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const dict = getDictionary(locale);
  const config = dict.auth.modes[mode];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(''); setSuccess('');
    const values = new FormData(event.currentTarget);
    const endpoint = mode === 'login' ? '/api/auth/login' : mode === 'register' ? '/api/auth/register' : mode === 'forgot' ? '/api/auth/forgot-password' : mode === 'reset' ? '/api/auth/reset-password' : '/api/auth/verify-email';
    const payload: Record<string, unknown> = Object.fromEntries(values.entries());
    if (token) payload.token = token;
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { message?: string; error?: { message?: string; details?: { path: string; message: string }[] } };
      if (!response.ok) throw new Error(result.error?.details?.[0]?.message || result.error?.message || dict.auth.genericError);
      if (mode === 'login' || mode === 'register') { router.replace('/dashboard'); router.refresh(); return; }
      setSuccess(result.message || (mode === 'reset' ? dict.auth.successReset : mode === 'verify' ? dict.auth.successVerify : dict.auth.successForgot));
    } catch (reason) { setError(reason instanceof Error ? reason.message : dict.auth.genericError); }
    finally { setPending(false); }
  }

  return <div className="auth-card" lang={locale}><div className="auth-card-heading"><span className="eyebrow">{mode === 'register' ? dict.auth.newChapter : dict.auth.space}</span><h1>{config.title}</h1><p>{config.subtitle}</p></div><form onSubmit={submit} className="auth-form" method="post">
    {mode === 'register' && <><label>{dict.auth.name}<input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Camille Dupont" /></label><label>{dict.auth.workspaceName} <span className="optional">{dict.common.optional}</span><input name="workspaceName" maxLength={100} placeholder="Studio Camille" /></label></>}
    {(mode === 'login' || mode === 'register' || mode === 'forgot') && <label>{dict.auth.email}<input name="email" type="email" required autoComplete="email" placeholder="vous@exemple.com" /></label>}
    {(mode === 'login' || mode === 'register') && <label>{dict.auth.password}<input name="password" type="password" required minLength={mode === 'register' ? 12 : 1} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={mode === 'register' ? dict.auth.passwordHint : dict.auth.passwordPlaceholder} /></label>}
    {mode === 'reset' && <label>{dict.auth.newPassword}<input name="password" type="password" required minLength={12} autoComplete="new-password" /></label>}
    {error && <div className="alert error" role="alert">{error}</div>}{success && <div className="alert success" role="status">{success}</div>}
    <button className="button coral full" disabled={pending}>{pending ? dict.auth.pending : config.action}<span aria-hidden="true">→</span></button>
  </form><div className="auth-links">{mode === 'login' && <><Link href="/forgot-password">{dict.auth.forgot}</Link><span>{dict.auth.noAccount} <Link href="/register">{dict.auth.createAccount}</Link></span></>}{mode === 'register' && <span>{dict.auth.haveAccount} <Link href="/login">{dict.auth.login}</Link></span>}{['forgot', 'reset', 'verify'].includes(mode) && <Link href="/login">{dict.auth.backToLogin}</Link>}</div></div>;
}
