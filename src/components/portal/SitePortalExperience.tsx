'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client-api';
import type { PortalField, SitePortal, SitePortalItem } from '@/lib/application/intake';

type Viewer = { name: string; email: string };
type RequestsPayload = { objectLabel: string; items: SitePortalItem[] };

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

export function SitePortalExperience({ portal, viewer, initialRequests }: {
  portal: SitePortal;
  viewer: Viewer | null;
  initialRequests: RequestsPayload | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [auth, setAuth] = useState({ name: '', email: '', password: '' });
  const [values, setValues] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<RequestsPayload | null>(initialRequests);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const base = `/api/portal/${portal.project.slug}`;

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setNotice('');
    try {
      await apiFetch(`${base}/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(mode === 'register' ? auth : { email: auth.email, password: auth.password }),
      }, 'woob_site_csrf');
      setAuth({ name: '', email: '', password: '' });
      router.refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setError('');
    try {
      await apiFetch(`${base}/auth/logout`, { method: 'POST' }, 'woob_site_csrf');
      router.refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setNotice('');
    const data: Record<string, unknown> = {};
    for (const field of portal.fields) {
      const raw = (values[field.key] ?? '').trim();
      if (!raw) continue;
      if (field.type === 'integer' || field.type === 'number') data[field.key] = Number(raw);
      else if (field.type === 'boolean') data[field.key] = raw === 'true';
      else data[field.key] = raw;
    }
    try {
      await apiFetch(`${base}/requests`, { method: 'POST', body: JSON.stringify({ data }) }, 'woob_site_csrf');
      setValues({});
      setNotice('Votre demande est enregistrée. Son statut est suivi ci-dessous.');
      setRequests(await apiFetch<RequestsPayload>(`${base}/requests`, {}, 'woob_site_csrf'));
      router.refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  function renderField(field: PortalField) {
    const id = `site-field-${field.key}`;
    const helpId = `${id}-help`;
    const value = values[field.key] ?? '';
    const update = (next: string) => { setValues((current) => ({ ...current, [field.key]: next })); setError(''); };
    const label = <label htmlFor={id}>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>;
    const help = field.help ? <small id={helpId}>{field.help}</small> : null;
    const describedBy = field.help ? helpId : undefined;
    let control;
    if (field.type === 'enum') {
      control = <select id={id} required={field.required} aria-describedby={describedBy} value={value} onChange={(event) => update(event.target.value)}>
        <option value="">Choisir…</option>
        {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>;
    } else if (field.type === 'relation') {
      control = <select id={id} required={field.required} aria-describedby={describedBy} value={value} onChange={(event) => update(event.target.value)}>
        <option value="">Choisir…</option>
        {(field.relation?.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>;
    } else if (field.type === 'boolean') {
      control = <select id={id} aria-describedby={describedBy} value={value} onChange={(event) => update(event.target.value)}>
        <option value="">Non renseigné</option>
        <option value="true">Oui</option>
        <option value="false">Non</option>
      </select>;
    } else if (field.type === 'textarea') {
      control = <textarea id={id} rows={4} required={field.required} maxLength={10_000} aria-describedby={describedBy} value={value} onChange={(event) => update(event.target.value)} />;
    } else {
      const inputType = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' ? 'date' : field.type === 'integer' || field.type === 'number' ? 'number' : 'text';
      control = <input
        id={id}
        type={inputType}
        required={field.required}
        step={field.type === 'integer' ? 1 : field.type === 'number' ? 'any' : undefined}
        maxLength={field.type === 'text' || field.type === 'email' || field.type === 'phone' ? 240 : undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(event) => update(event.target.value)}
      />;
    }
    const relationNote = field.type === 'relation'
      ? <small>{field.relation?.options.length ? `Choisissez parmi les ${field.relation.options.length} option${field.relation.options.length > 1 ? 's' : ''} proposée${field.relation.options.length > 1 ? 's' : ''} par ce site.` : 'Aucun choix disponible pour le moment.'}</small>
      : null;
    return <div className="site-portal-field" key={field.key}>{label}{control}{help}{relationNote}</div>;
  }

  return <main className="site-portal">
    <header className="site-portal-header">
      <p className="site-portal-brand">Espace du site</p>
      <h1>{portal.title}</h1>
      <p>{portal.intro || `Déposez et suivez une demande auprès de ${portal.project.name}.`}</p>
      {viewer && <div className="site-portal-account"><span>{viewer.name} · {viewer.email}</span><button type="button" className="button ghost small" disabled={pending} onClick={() => void logout()}>Se déconnecter</button></div>}
    </header>

    {!viewer ? <section className="site-portal-card" aria-labelledby="site-portal-auth-title">
      <h2 id="site-portal-auth-title">Créez votre compte sur ce site</h2>
      <p>Ce compte est propre à {portal.project.name}. Il ne donne accès à aucun espace de gestion Woob et reste séparé des sessions Studio.</p>
      <div className="site-portal-tabs" role="group" aria-label="Connexion ou création de compte">
        <button type="button" className={`button small ${mode === 'register' ? 'coral' : 'secondary'}`} aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>Créer un compte</button>
        <button type="button" className={`button small ${mode === 'login' ? 'coral' : 'secondary'}`} aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>J’ai déjà un compte</button>
      </div>
      <form onSubmit={authenticate} className="site-portal-form">
        {mode === 'register' && <div className="site-portal-field"><label htmlFor="site-name">Nom complet<span aria-hidden="true"> *</span></label><input id="site-name" required minLength={2} maxLength={100} autoComplete="name" value={auth.name} onChange={(event) => setAuth((current) => ({ ...current, name: event.target.value }))} /></div>}
        <div className="site-portal-field"><label htmlFor="site-email">Adresse email<span aria-hidden="true"> *</span></label><input id="site-email" type="email" required autoComplete="email" value={auth.email} onChange={(event) => setAuth((current) => ({ ...current, email: event.target.value }))} /></div>
        <div className="site-portal-field"><label htmlFor="site-password">Mot de passe{mode === 'register' && <span aria-hidden="true"> *</span>}</label><input id="site-password" type="password" required minLength={mode === 'register' ? 12 : 1} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} aria-describedby={mode === 'register' ? 'site-password-help' : undefined} value={auth.password} onChange={(event) => setAuth((current) => ({ ...current, password: event.target.value }))} />{mode === 'register' && <small id="site-password-help">12 caractères minimum.</small>}</div>
        <button type="submit" className="button coral" disabled={pending}>{pending ? 'Patientez…' : mode === 'register' ? 'Créer mon compte' : 'Se connecter'}</button>
      </form>
    </section> : <>
      <section className="site-portal-card" aria-labelledby="site-portal-form-title">
        <h2 id="site-portal-form-title">Nouvelle demande</h2>
        <p>Les informations marquées d’un astérisque sont obligatoires. Votre demande est examinée par l’équipe du site.</p>
        <form onSubmit={submitRequest} className="site-portal-form">
          {portal.fields.map((field) => renderField(field))}
          <button type="submit" className="button coral" disabled={pending}>{pending ? 'Envoi…' : 'Envoyer ma demande'}</button>
        </form>
      </section>

      <section className="site-portal-card" aria-labelledby="site-portal-requests-title">
        <h2 id="site-portal-requests-title">Mes demandes</h2>
        {requests?.items.length ? <ul className="site-portal-requests">
          {requests.items.map((item) => <li key={item.id}>
            <div><strong>{item.title}</strong><small>Déposée le {formatDate(item.createdAt)}</small></div>
            <span className={`status-pill ${item.status === 'accepte' || item.status === 'confirmee' ? 'success' : ''}`}>{item.statusLabel ?? 'En cours'}</span>
          </li>)}
        </ul> : <p>Aucune demande pour l’instant. Votre première demande apparaîtra ici avec son statut.</p>}
      </section>
    </>}

    {error && <p className="site-portal-error" role="alert">{error}</p>}
    {notice && <p className="site-portal-notice" role="status">{notice}</p>}
    <footer className="site-portal-footer"><p>Ce portail ne remplace pas les services du site : aucune donnée d’autres personnes n’y est visible.</p></footer>
  </main>;
}
