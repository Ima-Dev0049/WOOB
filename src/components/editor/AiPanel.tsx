'use client';

import { useState } from 'react';
import type { PageDocument, SiteSnapshot } from '@/lib/document/types';
import { applyAiProposal, type AiProposal } from '@/lib/document/ai';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { DocumentRenderer } from '@/components/renderer/DocumentRenderer';
import { useModalFocus } from '@/components/ui/useModalFocus';

type Result = { proposal: AiProposal; provider: string; model: string; demo: boolean };
export function AiPanel({ pageId, document, site, selectedNodeId, onApply, onClose }: { pageId: string; document: PageDocument; site: SiteSnapshot; selectedNodeId: string; onApply: (document: PageDocument) => void; onClose: () => void }) {
  const [instruction, setInstruction] = useState(''); const [pending, setPending] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState<Result | null>(null); const [preview, setPreview] = useState<PageDocument | null>(null);
  const dialogRef = useModalFocus<HTMLElement>(true, onClose);
  async function generate(event: React.FormEvent) { event.preventDefault(); setPending(true); setError(''); setResult(null); setPreview(null); try { const generated = await apiFetch<Result>(`/api/pages/${pageId}/ai`, { method: 'POST', body: JSON.stringify({ instruction, selectedNodeId }) }); setResult(generated); setPreview(applyAiProposal(document, generated.proposal)); } catch (reason) { setError(errorMessage(reason)); } finally { setPending(false); } }
  return <div className="modal-backdrop"><section ref={dialogRef} tabIndex={-1} className="modal ai-modal" role="dialog" aria-modal="true" aria-labelledby="ai-title"><header><div><span className="eyebrow">Assistant structuré</span><h2 id="ai-title">Proposer une modification</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer">×</button></header><form onSubmit={generate}><label>Votre consigne<textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} minLength={3} maxLength={1000} rows={4} required placeholder="Ex. Présente notre atelier céramique avec un ton chaleureux" /></label><p className="ai-privacy">Le mode démo reste local. Si un fournisseur distant est configuré, le document et la consigne peuvent lui être transmis. Aucun code n’est exécuté.</p><button className="button coral" disabled={pending}>{pending ? 'Génération…' : 'Générer une proposition'}</button></form>{error && <div className="alert error">{error}</div>}{result && preview && <div className="ai-result"><div className="ai-result-heading"><div><span className={`ai-provider ${result.demo ? 'demo' : ''}`}>{result.demo ? 'DÉMO LOCALE' : result.provider.toUpperCase()}</span><strong>{result.proposal.summary}</strong><small>{result.model} · {result.proposal.operations.length} opération(s)</small></div><button className="button dark small" onClick={() => onApply(preview)}>Appliquer au brouillon</button></div><div className="ai-preview"><DocumentRenderer document={preview} context={{ mode: 'editor', site, projectId: site.projectId, slug: site.slug }} /></div></div>}</section></div>;
}
