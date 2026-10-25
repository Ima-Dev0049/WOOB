'use client';

import { useMemo, useState } from 'react';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { addSimpleApplicationObject, type SimpleApplicationObjectInput } from '@/lib/application/model-editor';
import { applicationModelSchema, buildApplicationRoutes, type ApplicationModel } from '@/lib/application/model';

const emptyObject: SimpleApplicationObjectInput = { label: '', pluralLabel: '', key: '', description: '' };

export function ApplicationModelEditor({ model, version, baseUrl, onApplied, onCancel }: {
  model: ApplicationModel;
  version: number;
  baseUrl: string;
  onApplied: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ApplicationModel>(() => structuredClone(model));
  const [newObject, setNewObject] = useState<SimpleApplicationObjectInput>(emptyObject);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const parsedDraft = useMemo(() => applicationModelSchema.safeParse(draft), [draft]);
  const routeCount = parsedDraft.success ? buildApplicationRoutes(parsedDraft.data).length : 0;
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(model), [draft, model]);
  const originalKeys = useMemo(() => new Set(model.objects.map((object) => object.key)), [model]);

  function updateNewObject(field: keyof SimpleApplicationObjectInput, value: string) {
    setNewObject((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function addObject() {
    try {
      const next = addSimpleApplicationObject(draft, newObject);
      setDraft(next);
      setNewObject(emptyObject);
      setError('');
    } catch {
      setError('Impossible d’ajouter cet objet. Vérifiez les noms, la clé technique et les limites du modèle.');
    }
  }

  async function apply() {
    if (!parsedDraft.success) {
      setError(`Le brouillon est invalide : ${parsedDraft.error.issues[0]?.message ?? 'vérifiez les champs.'}`);
      return;
    }
    setPending(true);
    setError('');
    try {
      await apiFetch(baseUrl, { method: 'PUT', body: JSON.stringify({ model: parsedDraft.data, baseVersion: version }) });
      onApplied();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return <section className="application-record-form application-model-editor" aria-labelledby="application-model-editor-title">
    <header>
      <div><h2 id="application-model-editor-title">Personnaliser le modèle</h2><p>Prévisualisez une version structurée avant de modifier l’application active.</p></div>
      <button type="button" className="button ghost small" disabled={pending} onClick={onCancel}>Fermer</button>
    </header>
    <div className="application-model-editor-layout">
      <div className="application-model-editor-controls">
        <div className="application-form-grid">
          <label>Nom du modèle<input value={draft.name} required maxLength={120} onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); setError(''); }} /></label>
          <label>Description du modèle<textarea rows={3} maxLength={500} value={draft.description} onChange={(event) => { setDraft((current) => ({ ...current, description: event.target.value })); setError(''); }} /></label>
        </div>
        <fieldset className="application-model-new-object">
          <legend>Ajouter un objet simple</legend>
          <p>Le nouvel objet contient un champ « Nom » requis. Les champs, processus et relations existants ne sont pas modifiés.</p>
          <div className="application-form-grid">
            <label>Nom singulier<input value={newObject.label} required maxLength={120} placeholder="Club" onChange={(event) => updateNewObject('label', event.target.value)} /></label>
            <label>Nom pluriel<input value={newObject.pluralLabel} required maxLength={120} placeholder="Clubs" onChange={(event) => updateNewObject('pluralLabel', event.target.value)} /></label>
            <label>Clé technique<input value={newObject.key} maxLength={48} placeholder="Générée si vide" onChange={(event) => updateNewObject('key', event.target.value)} /><small>Minuscules, chiffres et tirets ; une clé déjà utilisée reçoit un suffixe.</small></label>
            <label>Description de l’objet<textarea rows={3} maxLength={300} value={newObject.description} onChange={(event) => updateNewObject('description', event.target.value)} /></label>
          </div>
          <button type="button" className="button secondary small" disabled={pending || !newObject.label.trim() || !newObject.pluralLabel.trim()} onClick={addObject}>Ajouter l’objet au brouillon</button>
        </fieldset>
      </div>
      <aside className="application-model-preview" aria-label="Aperçu du brouillon de modèle">
        <span className="status-pill">Brouillon non enregistré</span>
        <h3>{parsedDraft.success ? parsedDraft.data.name : 'Brouillon à corriger'}</h3>
        <p>{parsedDraft.success ? parsedDraft.data.description || 'Aucune description.' : 'Corrigez les champs avant l’enregistrement.'}</p>
        <div className="application-model-preview-metrics"><strong>{draft.objects.length} objets</strong><span>{parsedDraft.success ? routeCount : '—'} routes logiques</span></div>
        <ul>{draft.objects.map((object) => {
          const added = !originalKeys.has(object.key);
          return <li key={object.key}><div><strong>{object.pluralLabel}</strong><code>{object.key}</code></div>{added && <><span className="application-model-new-badge">Nouveau</span><button type="button" className="button ghost small" disabled={pending} aria-label={`Retirer ${object.pluralLabel} du brouillon`} onClick={() => { setDraft((current) => ({ ...current, objects: current.objects.filter((candidate) => candidate.key !== object.key) })); setError(''); }}>Retirer</button></>}</li>;
        })}</ul>
        <p className="application-model-permissions">Les grants existants sont conservés. Seuls les rôles avec un grant global ou explicite sur le nouvel objet y auront accès. L’enregistrement sera refusé si la version active n’est plus v{version}.</p>
      </aside>
    </div>
    {error && <p className="form-status" role="alert">{error}</p>}
    <div className="button-row"><button type="button" className="button coral small" disabled={pending || !dirty} onClick={() => void apply()}>{pending ? 'Enregistrement…' : 'Appliquer le brouillon'}</button><button type="button" className="button secondary small" disabled={pending} onClick={onCancel}>Annuler le brouillon</button></div>
  </section>;
}
