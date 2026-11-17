'use client';

import { useState } from 'react';
import { apiFetch, errorMessage } from '@/lib/client-api';
import type { PublicIntakeSettings } from '@/lib/application/intake';

type EligibleObject = { key: string; label: string; pluralLabel: string };

export function PublicIntakePanel({ projectId, slug, intake, objects }: {
  projectId: string;
  slug: string;
  intake: PublicIntakeSettings;
  objects: EligibleObject[];
}) {
  const [settings, setSettings] = useState<PublicIntakeSettings>({
    enabled: intake.enabled ?? false,
    ...(intake.objectKey ? { objectKey: intake.objectKey } : {}),
    title: intake.title ?? '',
    intro: intake.intro ?? '',
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [portalPath, setPortalPath] = useState(`/portail/${slug}`);

  const selected = objects.find((object) => object.key === settings.objectKey) ?? objects[0];

  function update<K extends keyof PublicIntakeSettings>(key: K, value: PublicIntakeSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setError('');
    setSaved(false);
  }

  async function save() {
    setPending(true);
    setError('');
    try {
      const result = await apiFetch<{ intake: PublicIntakeSettings; portalPath: string }>(`/api/projects/${projectId}/public-intake`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled: settings.enabled,
          ...(settings.objectKey ? { objectKey: settings.objectKey } : {}),
          title: settings.title ?? '',
          intro: settings.intro ?? '',
        }),
      });
      setSettings(result.intake);
      setPortalPath(result.portalPath);
      setSaved(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return <section className="public-intake-panel" aria-labelledby="public-intake-title">
    <header><div><h2 id="public-intake-title">Demandes en ligne</h2><p>Ouvrez un formulaire public pour un objet de ce modèle. Les personnes créent leur compte sur ce site, suivent leurs demandes et ne voient jamais les autres dossiers.</p></div></header>
    <div className="public-intake-body">
      <label className="public-intake-toggle"><input type="checkbox" checked={settings.enabled} disabled={pending || objects.length === 0} onChange={(event) => update('enabled', event.target.checked)} /><span>Ouvrir le portail public de ce site</span></label>
      {objects.length === 0
        ? <p className="form-status">Aucun objet du modèle actif ne possède de statut : initialisez ou complétez le modèle avant d’ouvrir un formulaire public.</p>
        : <>
          <div className="application-form-grid">
            <label>Objet du formulaire public<select value={settings.objectKey ?? selected?.key ?? ''} disabled={pending} onChange={(event) => update('objectKey', event.target.value)}>{objects.map((object) => <option key={object.key} value={object.key}>{object.pluralLabel} ({object.key})</option>)}</select><small>Les champs requis et les choix liés sont déduits du modèle, jamais dupliqués.</small></label>
            <label>Titre public<input value={settings.title ?? ''} maxLength={120} disabled={pending} placeholder={selected?.pluralLabel ?? ''} onChange={(event) => update('title', event.target.value)} /></label>
          </div>
          <label>Introduction<textarea rows={3} maxLength={500} value={settings.intro ?? ''} disabled={pending} placeholder="Décrivez la démarche et le délai de réponse." onChange={(event) => update('intro', event.target.value)} /></label>
        </>}
      {settings.enabled && <p className="public-intake-link">Portail public : <a href={portalPath}>{portalPath}</a><small>Toute personne peut créer un compte sur ce site pour déposer une demande ; aucune session Studio n’y donne accès.</small></p>}
      {error && <p className="form-status" role="alert">{error}</p>}
      {saved && <p className="form-status" role="status">Formulaire public enregistré.</p>}
      <div className="button-row"><button type="button" className="button coral small" disabled={pending || objects.length === 0} onClick={() => void save()}>{pending ? 'Enregistrement…' : 'Enregistrer le formulaire public'}</button>{settings.enabled && <a className="button secondary small" href={portalPath}>Ouvrir le portail</a>}</div>
    </div>
  </section>;
}
