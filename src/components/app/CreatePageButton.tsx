'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client-api';
export function CreatePageButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false); const [error, setError] = useState(''); const [pending, setPending] = useState(false); const router = useRouter();
  async function create(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); const data = new FormData(event.currentTarget); try { const result = await apiFetch<{ page: { id: string } }>(`/api/projects/${projectId}/pages`, { method: 'POST', body: JSON.stringify({ name: data.get('name'), path: data.get('path') }) }); router.push(`/dashboard/projects/${projectId}/editor/${result.page.id}`); } catch (reason) { setError(errorMessage(reason)); setPending(false); } }
  return <><button className="button secondary small" onClick={() => setOpen(true)}>＋ Ajouter une page</button>{open && <div className="modal-backdrop"><form className="modal small-modal" onSubmit={create}><header><h2>Nouvelle page</h2><button type="button" className="icon-button" onClick={() => setOpen(false)}>×</button></header><label>Nom<input name="name" required autoFocus placeholder="À propos" /></label><label>Chemin<input name="path" placeholder="/a-propos" /><small>Laissez vide pour le générer depuis le nom.</small></label>{error && <div className="alert error">{error}</div>}<button className="button coral" disabled={pending}>{pending ? 'Création…' : 'Créer et ouvrir'}</button></form></div>}</>;
}
