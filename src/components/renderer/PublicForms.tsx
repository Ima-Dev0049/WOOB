'use client';

import { useState } from 'react';

type BaseProps = { projectId: string; title: string; description?: string; submitLabel: string; disabled?: boolean };

export function PublicContactForm({ projectId, formKey, title, description, submitLabel, disabled = false }: BaseProps & { formKey: string }) {
  const [state, setState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setState('pending');
    try {
      const response = await fetch('/api/public/forms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, formKey, name: values.get('name'), email: values.get('email'), message: values.get('message'), website: values.get('website') }) });
      const result = await response.json() as { message?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || 'Envoi impossible.');
      form.reset();
      setState('success');
      setMessage(result.message || 'Votre demande a bien été enregistrée.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Envoi impossible.');
    }
  }
  return <div className="public-form-shell" id="contact">
    <h2>{title}</h2>{description && <p>{description}</p>}
    <form onSubmit={submit} className="public-form">
      <div className="form-grid two"><label>Nom<input name="name" required maxLength={120} autoComplete="name" disabled={disabled} /></label><label>Email<input name="email" type="email" required maxLength={240} autoComplete="email" disabled={disabled} /></label></div>
      <label>Message<textarea name="message" required minLength={5} maxLength={5000} rows={5} disabled={disabled} /></label>
      <label className="honeypot" aria-hidden="true">Site web<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <button className="button primary" disabled={disabled || state === 'pending'}>{state === 'pending' ? 'Envoi…' : submitLabel}</button>
      {message && <p className={`form-status ${state}`} role="status">{message}</p>}
    </form>
  </div>;
}

export function PublicReservationForm({ projectId, serviceName, title, description, submitLabel, disabled = false }: BaseProps & { serviceName: string }) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    try {
      const response = await fetch('/api/public/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, serviceName, name: values.get('name'), email: values.get('email'), requestedAt: values.get('requestedAt'), partySize: Number(values.get('partySize')), notes: values.get('notes') }) });
      const result = await response.json() as { message?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || 'Réservation impossible.');
      form.reset(); setMessage(result.message || 'Votre demande est enregistrée, en attente de confirmation.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Réservation impossible.'); }
    finally { setPending(false); }
  }
  return <div className="public-form-shell"><h2>{title}</h2>{description && <p>{description}</p>}<form onSubmit={submit} className="public-form">
    <div className="form-grid two"><label>Nom<input name="name" required maxLength={120} disabled={disabled} /></label><label>Email<input name="email" type="email" required maxLength={240} disabled={disabled} /></label></div>
    <div className="form-grid two"><label>Date et heure<input name="requestedAt" type="datetime-local" required disabled={disabled} /></label><label>Personnes<input name="partySize" type="number" min="1" max="20" defaultValue="2" required disabled={disabled} /></label></div>
    <label>Précisions<textarea name="notes" maxLength={2000} rows={3} disabled={disabled} /></label>
    <button className="button primary" disabled={disabled || pending}>{pending ? 'Envoi…' : submitLabel}</button>{message && <p className="form-status" role="status">{message}</p>}
  </form></div>;
}

export function PublicOrderButton({ projectId, productId, productName, disabled = false }: { projectId: string; productId: string; productName: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch('/api/public/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, customerName: values.get('name'), customerEmail: values.get('email'), items: [{ productId, quantity: Number(values.get('quantity')) }] }) });
      const result = await response.json() as { message?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || 'Commande impossible.');
      setMessage(result.message || 'Commande enregistrée. Aucun paiement en ligne n’a été effectué.'); setOpen(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Commande impossible.'); }
    finally { setPending(false); }
  }
  return <><button className="button secondary small" onClick={() => setOpen(!open)} disabled={disabled}>Commander</button>{open && <form className="order-popover" onSubmit={submit}><strong>{productName}</strong><label>Nom<input name="name" required maxLength={120} /></label><label>Email<input name="email" type="email" required /></label><label>Quantité<input name="quantity" type="number" min="1" max="99" defaultValue="1" /></label><button className="button primary small" disabled={pending}>Enregistrer la commande</button><small>Commande manuelle, sans paiement en ligne.</small></form>}{message && <p className="form-status" role="status">{message}</p>}</>;
}
