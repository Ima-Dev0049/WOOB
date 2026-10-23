'use client';

import { useModalFocus } from '@/components/ui/useModalFocus';
import type { PublicationPreflightReport } from '@/lib/publication/preflight';

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} Mo`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} ko`;
  return `${bytes} o`;
}

export function PublicationPreflightDialog({ report, pending, onClose, onConfirm }: {
  report: PublicationPreflightReport;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useModalFocus<HTMLElement>(true, onClose);
  const issues = report.issues.filter((issue) => issue.severity !== 'info');
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const title = report.status === 'blocked' ? 'Publication à corriger' : 'Vérifier avant publication';
  return <div className="modal-backdrop"><section ref={dialogRef} tabIndex={-1} className="modal publication-preflight-modal" role="dialog" aria-modal="true" aria-labelledby="publication-preflight-title" data-testid="publication-preflight">
    <header><div><span className="eyebrow">Contrôle serveur</span><h2 id="publication-preflight-title">{title}</h2><p>Le serveur recalculera ce rapport au moment de publier.</p></div><button className="icon-button" onClick={onClose} disabled={pending} aria-label="Fermer">×</button></header>
    <div className={`publication-preflight-summary ${report.status}`} role="status">
      <strong>{report.status === 'blocked' ? `${errorCount} blocage${errorCount > 1 ? 's' : ''}` : `${warningCount} avertissement${warningCount > 1 ? 's' : ''}`}</strong>
      <span>{report.status === 'blocked' ? 'Corrigez les erreurs avant de créer une nouvelle version publique.' : 'Vous pouvez publier après avoir pris connaissance de ces points.'}</span>
    </div>
    <dl className="publication-preflight-metrics">
      <div><dt>Pages</dt><dd>{report.metrics.pageCount}</dd></div>
      <div><dt>Contraste minimal</dt><dd>{report.metrics.minimumContrast === null ? 'Non calculable' : `${report.metrics.minimumContrast.toFixed(2)}:1`}</dd></div>
      <div><dt>Médias managés</dt><dd>{formatBytes(report.metrics.managedAssetBytes)}</dd></div>
      <div><dt>Page la plus lourde</dt><dd>{formatBytes(report.metrics.maxPageAssetBytes)}</dd></div>
      <div><dt>Entrées animées</dt><dd>{report.metrics.motionNodes}</dd></div>
      <div><dt>Pages avec 3D</dt><dd>{report.metrics.scene3dPages}</dd></div>
    </dl>
    {issues.length > 0 && <ul className="publication-preflight-issues">{issues.map((issue) => <li key={issue.id} className={issue.severity}><strong>{issue.severity === 'error' ? 'Erreur' : 'Avertissement'}</strong><span>{issue.message}</span></li>)}</ul>}
    <details className="publication-preflight-pages"><summary>Mesures par page</summary><div><table><caption className="font-sr-only">Poids des médias et effets par page</caption><thead><tr><th>Page</th><th>Médias</th><th>Motion</th><th>3D</th></tr></thead><tbody>{report.pages.map((page) => <tr key={page.id}><th scope="row">{page.path}</th><td>{page.assetCount} · {formatBytes(page.assetBytes)}</td><td>{page.motionNodes}</td><td>{page.scene3dCount}</td></tr>)}</tbody></table></div></details>
    <p className="publication-preflight-note">Contrôles structurels et poids des médias managés uniquement. Seuils par page : alerte au-delà de {formatBytes(report.budgets.pageAssetWarningBytes)}, blocage au-delà de {formatBytes(report.budgets.pageAssetErrorBytes)}. Ce rapport n’est ni un audit Lighthouse ni une mesure de LCP ou de la connexion.</p>
    <footer><button type="button" className="button ghost" onClick={onClose} disabled={pending}>{report.status === 'blocked' ? 'Retour à l’éditeur' : 'Annuler'}</button>{report.status !== 'blocked' && <button type="button" className="button coral" onClick={onConfirm} disabled={pending}>{pending ? 'Publication…' : `Publier avec ${warningCount} avertissement${warningCount > 1 ? 's' : ''}`}</button>}</footer>
  </section></div>;
}
