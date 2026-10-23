'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client-api';
import type { Project } from '@/server/db/schema';

export function ProjectSettingsForm({ project }: { project: Project }) {
  const [pending, setPending] = useState(false); const [message, setMessage] = useState(''); const router = useRouter();
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); const values = new FormData(event.currentTarget); try { await apiFetch(`/api/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify({ name: values.get('name'), description: values.get('description'), defaultLocale: values.get('defaultLocale') }) }); setMessage('Paramètres enregistrés.'); router.refresh(); } catch (error) { setMessage(errorMessage(error)); } finally { setPending(false); } }
  async function remove() { if (!window.confirm(`Supprimer le projet « ${project.name} » ? Son adresse publique sera désactivée.`)) return; setPending(true); try { await apiFetch(`/api/projects/${project.id}`, { method: 'DELETE' }); router.push('/dashboard'); } catch (error) { setMessage(errorMessage(error)); setPending(false); } }
  return <form className="settings-card" onSubmit={save}><header><h2>Informations du projet</h2><p>Le nom et la langue par défaut sont repris dans les nouvelles publications.</p></header><div className="form-grid two"><label>Nom du projet<input name="name" defaultValue={project.name} required minLength={2} /></label><label>Langue par défaut<select name="defaultLocale" defaultValue={project.defaultLocale}><option value="fr">Français</option><option value="en">English</option></select></label></div><label>Description<textarea name="description" defaultValue={project.description} maxLength={500} rows={3} /></label>{message && <p className="form-status" role="status">{message}</p>}<div className="settings-actions"><button className="button dark" disabled={pending}>Enregistrer</button><button className="button danger" type="button" onClick={remove} disabled={pending}>Supprimer le projet</button></div></form>;
}
