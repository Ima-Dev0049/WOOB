'use client';

import { useEffect, useState } from 'react';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { useModalFocus } from '@/components/ui/useModalFocus';

type Version = { id: string; versionNumber: number; kind: string; sourceRevision: number; createdAt: string };
const kindLabel: Record<string, string> = { manual: 'Point manuel', published: 'Publication', restore: 'Restauration' };
export function VersionHistory({ pageId, onRestore, onClose }: { pageId: string; onRestore: (versionId: string) => Promise<boolean>; onClose: () => void }) {
  const [versions, setVersions] = useState<Version[]>([]); const [loading, setLoading] = useState(true); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const dialogRef = useModalFocus<HTMLElement>(true, onClose);
  useEffect(() => {
    let active = true;
    void apiFetch<{ versions: Version[] }>(`/api/pages/${pageId}/versions`).then((result) => { if (active) setVersions(result.versions); }).catch((reason) => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pageId]);
  async function restore(versionId: string) { setPending(true); setError(''); try { const restored = await onRestore(versionId); if (!restored) setError('La restauration a été annulée ou a échoué.'); } catch (reason) { setError(errorMessage(reason)); } finally { setPending(false); } }
  return <div className="modal-backdrop"><section ref={dialogRef} tabIndex={-1} className="modal version-modal" role="dialog" aria-modal="true" aria-labelledby="version-title"><header><div><span className="eyebrow">Brouillon</span><h2 id="version-title">Historique de la page</h2><p>Restaurer crée une nouvelle révision sans effacer l’historique.</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer">×</button></header>{error && <div className="alert error" role="alert">{error}</div>}{loading ? <p className="muted">Chargement de l’historique…</p> : versions.length ? <div className="version-list">{versions.map((version) => <article key={version.id}><div><strong>Version {version.versionNumber}</strong><span className="status-pill">{kindLabel[version.kind] || version.kind}</span></div><p>Révision source {version.sourceRevision} · {new Date(version.createdAt).toLocaleString('fr-FR')}</p><button className="button secondary small" disabled={pending} onClick={() => restore(version.id)}>Restaurer cette version</button></article>)}</div> : <div className="empty-state"><p>Aucun point de restauration. Enregistrez d’abord la page, puis créez un point depuis le canevas.</p></div>}</section></div>;
}
