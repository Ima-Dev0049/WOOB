'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, errorMessage } from '@/lib/client-api';

type Attachment = {
  id: string;
  assetId: string;
  label: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = 'image/png,image/jpeg,image/webp,image/gif,application/pdf';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} Ko`;
  return `${Math.round(bytes / 104857.6) / 10} Mo`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
}

/**
 * Files attached to one managed record. The upload goes through the project asset
 * library first, then the attachment links the stored asset to the record.
 */
export function ApplicationAttachments({ projectId, baseUrl, objectKey, recordId, canManage, labels }: {
  projectId: string;
  baseUrl: string;
  objectKey: string;
  recordId: string;
  canManage: boolean;
  labels: { singular: string; plural: string };
}) {
  const endpoint = `${baseUrl}/objects/${objectKey}/${recordId}/attachments`;
  const [items, setItems] = useState<Attachment[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [fileKey, setFileKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);

  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch<{ attachments: Attachment[] }>(endpoint, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setItems(data.attachments); setError(''); } })
      .catch((reason: unknown) => { if (reason instanceof Error && reason.name !== 'AbortError') setError(errorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, refresh]);

  async function attach() {
    if (!file) { setError('Sélectionnez un fichier à joindre.'); return; }
    if (file.size > MAX_BYTES) { setError('Le fichier dépasse la limite de 5 Mo.'); return; }
    setPending(true); setError(''); setNotice('');
    try {
      const body = new FormData();
      body.append('file', file);
      const uploaded = await apiFetch<{ asset: { id: string } }>(`/api/projects/${projectId}/assets`, { method: 'POST', body });
      await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ assetId: uploaded.asset.id, label: label.trim() || file.name }) });
      setFile(null);
      setLabel('');
      setFileKey((value) => value + 1);
      setNotice(`${labels.singular.charAt(0).toUpperCase()}${labels.singular.slice(1)} ajoutée.`);
      reload();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setPending(false); }
  }

  async function detach(id: string) {
    if (!window.confirm(`Retirer cette ${labels.singular} du dossier ? Le fichier reste dans la bibliothèque du projet.`)) return;
    setPending(true); setError(''); setNotice('');
    try {
      await apiFetch(`${endpoint}?attachmentId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setItems((current) => current.filter((item) => item.id !== id));
      setNotice(`${labels.singular.charAt(0).toUpperCase()}${labels.singular.slice(1)} retirée.`);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setPending(false); }
  }

  return <section className="application-attachments" aria-labelledby="application-attachments-title">
    <header>
      <h4 id="application-attachments-title">{labels.plural.charAt(0).toUpperCase()}{labels.plural.slice(1)}</h4>
      <span className="status-pill">{loading ? 'Chargement…' : `${items.length} / 5`}</span>
    </header>
    <p className="field-hint">Documents liés à ce dossier : images ou PDF, 5 Mo maximum, cinq fichiers par dossier. Le fichier reste disponible dans la bibliothèque du projet.</p>
    {items.length > 0 && <ul className="application-attachment-list">{items.map((item) => <li key={item.id}>
      <a href={`/media/${item.assetId}`} target="_blank" rel="noreferrer">{item.label}</a>
      <small>{item.fileName} · {formatSize(item.byteSize)}{formatDate(item.createdAt) ? ` · ${formatDate(item.createdAt)}` : ''}</small>
      {canManage && <button type="button" className="button ghost small danger" disabled={pending} onClick={() => void detach(item.id)} aria-label={`Retirer ${item.label}`}>Retirer</button>}
    </li>)}</ul>}
    {!loading && !items.length && <p className="application-attachment-empty">Aucun fichier joint à ce dossier.</p>}
    {canManage && <div className="application-attachment-form">
      <div className="application-attachment-file">
        <span id="application-attachment-file-title" className="application-attachment-file-title">Fichier à joindre</span>
        <input key={fileKey} id="application-attachment-file" className="application-attachment-input" type="file" accept={ACCEPTED} disabled={pending} aria-labelledby="application-attachment-file-title" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} />
        <label className="button secondary small application-attachment-picker" htmlFor="application-attachment-file">Choisir un fichier</label>
        <span className="application-attachment-filename" aria-live="polite">{file ? `${file.name} · ${formatSize(file.size)}` : 'Aucun fichier sélectionné'}</span>
      </div>
      <label htmlFor="application-attachment-label">Libellé affiché
        <input id="application-attachment-label" type="text" maxLength={160} value={label} disabled={pending} placeholder={file?.name ?? 'Ex. Devis signé'} onChange={(event) => setLabel(event.currentTarget.value)} />
      </label>
      <div className="button-row">
        <button type="button" className="button secondary small" disabled={pending || !file} onClick={() => void attach()}>{pending ? 'Envoi…' : 'Joindre le fichier'}</button>
      </div>
    </div>}
    {error && <p className="form-status" role="alert">{error}</p>}
    {notice && <p className="form-status" role="status">{notice}</p>}
  </section>;
}
