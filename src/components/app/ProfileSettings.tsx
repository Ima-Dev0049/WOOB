'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { getDictionary, normalizeUiLocale } from '@/lib/i18n';
import type { User } from '@/server/db/schema';

export function ProfileSettings({ user }: { user: User }) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const dict = getDictionary(user.uiLocale);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage('');
    const values = new FormData(event.currentTarget);
    const nextLocale = normalizeUiLocale(values.get('uiLocale'));
    try {
      await apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ name: values.get('name'), uiLocale: nextLocale, timezone: values.get('timezone') }) });
      setMessage(getDictionary(nextLocale).profile.saved);
      router.refresh();
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setPending(false); }
  }
  return <form className="settings-card" onSubmit={save}><header><h2>{dict.profile.title}</h2><p>{dict.profile.subtitle}</p></header><div className="form-grid two"><label>{dict.profile.fullName}<input name="name" defaultValue={user.name} minLength={2} required /></label><label>{dict.profile.email}<input value={user.email} disabled /><small>{dict.profile.emailHelp}</small></label><label>{dict.profile.language}<select name="uiLocale" defaultValue={user.uiLocale}><option value="fr">Français</option><option value="en">English</option></select></label><label>{dict.profile.timezone}<select name="timezone" defaultValue={user.timezone}><option value="UTC">UTC</option><option value="Europe/Paris">Europe/Paris</option><option value="Africa/Lagos">Africa/Lagos</option><option value="Africa/Porto-Novo">Africa/Porto-Novo</option></select></label></div>{message && <p className="form-status" role="status">{message}</p>}<button className="button dark" disabled={pending}>{pending ? dict.profile.saving : dict.profile.save}</button></form>;
}
