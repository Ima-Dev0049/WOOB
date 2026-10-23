/* eslint-disable @next/next/no-img-element -- les médias privés exigent les cookies du navigateur, pas une optimisation serveur sans session. */
'use client';

import { useEffect, useState } from 'react';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { useModalFocus } from '@/components/ui/useModalFocus';

type Asset = { id: string; fileName: string; alt: string; byteSize: number; mimeType: string };
export function AssetLibrary({ projectId, onSelect, onClose }: { projectId: string; onSelect: (assetId: string) => void; onClose: () => void }) {
  const [assets, setAssets] = useState<Asset[]>([]); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const dialogRef = useModalFocus<HTMLElement>(true, onClose);
  useEffect(() => {
    let active = true;
    void apiFetch<{ assets: Asset[] }>(`/api/projects/${projectId}/assets`).then((result) => { if (active) setAssets(result.assets); }).catch((reason) => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);
  async function upload(file: File | undefined, input: HTMLInputElement) {
    if (!file) return; setPending(true); setError('');
    try { const body = new FormData(); body.set('file', file); body.set('alt', file.name.replace(/\.[^.]+$/, '')); const result = await apiFetch<{ asset: Asset }>(`/api/projects/${projectId}/assets`, { method: 'POST', body }); setAssets((current) => [result.asset, ...current]); }
    catch (reason) { setError(errorMessage(reason)); } finally { setPending(false); input.value = ''; }
  }
  const filtered = assets.filter((asset) => `${asset.fileName} ${asset.alt}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="modal asset-library-modal" role="dialog" aria-modal="true" aria-labelledby="asset-library-title"><header><div><span className="eyebrow">Médias du projet</span><h2 id="asset-library-title">Bibliothèque</h2><p>Réutilisez une image existante ou téléversez un nouveau fichier.</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer">×</button></header><div className="asset-library-actions"><label>Rechercher<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou texte alternatif" /></label><label className="button secondary small asset-upload-action">{pending ? 'Téléversement…' : 'Téléverser une image'}<input type="file" aria-label="Téléverser dans la bibliothèque" accept="image/png,image/jpeg,image/webp,image/gif" disabled={pending} onChange={(event) => { const input = event.currentTarget; void upload(input.files?.[0], input); }} /></label></div>{error && <div className="alert error" role="alert">{error}</div>}{loading ? <p className="muted">Chargement des médias…</p> : filtered.length ? <div className="asset-library-grid">{filtered.map((asset) => <button type="button" key={asset.id} onClick={() => onSelect(asset.id)} aria-label={`Utiliser ${asset.fileName}`}><img src={`/media/${asset.id}`} alt={asset.alt || asset.fileName} /><span><strong>{asset.fileName}</strong><small>{(asset.byteSize / 1024).toFixed(1)} Ko</small></span></button>)}</div> : <div className="empty-state"><p>{assets.length ? 'Aucun média ne correspond à cette recherche.' : 'Aucun média dans ce projet. Téléversez votre première image.'}</p></div>}</section></div>;
}
