'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';
import { getDictionary, type UiLocale } from '@/lib/i18n';

export function LogoutButton({ locale }: { locale: UiLocale }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const dict = getDictionary(locale);
  async function logout() {
    setPending(true);
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); router.replace('/login'); router.refresh(); }
    catch { setPending(false); }
  }
  return <button className="app-logout" onClick={logout} disabled={pending} title={dict.logout.title}><span aria-hidden="true">↪</span><span>{pending ? dict.logout.pending : dict.logout.label}</span></button>;
}
