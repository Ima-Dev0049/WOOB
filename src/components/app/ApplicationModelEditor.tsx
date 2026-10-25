'use client';

import { useMemo, useState } from 'react';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { addOptionalApplicationRelationField, addOptionalApplicationTextField, addSimpleApplicationObject, type ApplicationRelationFieldInput, type ApplicationTextFieldInput, type SimpleApplicationObjectInput } from '@/lib/application/model-editor';
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
  const [newField, setNewField] = useState<ApplicationTextFieldInput>(() => ({ objectKey: model.objects[0]?.key ?? '', label: '', key: '' }));
  const [newRelation, setNewRelation] = useState<ApplicationRelationFieldInput>(() => ({ objectKey: model.objects[0]?.key ?? '', targetObject: model.objects[0]?.key ?? '', label: '', key: '' }));
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

  function updateNewField(field: keyof ApplicationTextFieldInput, value: string) {
    setNewField((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function updateNewRelation(field: keyof ApplicationRelationFieldInput, value: string) {
    setNewRelation((current) => ({ ...current, [field]: value }));
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

  function addField() {
    try {
      const next = addOptionalApplicationTextField(draft, newField);
      setDraft(next);
      setNewField((current) => ({ ...current, label: '', key: '' }));
      setError('');
    } catch {
      setError('Impossible d’ajouter ce champ. Vérifiez l’objet cible, le nom et les limites du modèle.');
    }
  }

  function addRelation() {
    try {
      const next = addOptionalApplicationRelationField(draft, newRelation);
      setDraft(next);
      setNewRelation((current) => ({ ...current, label: '', key: '' }));
      setError('');
    } catch {
      setError('Impossible d’ajouter cette relation. Vérifiez les objets source et lié, le nom et les limites du modèle.');
    }
  }

  function removeObject(objectKey: string) {
    setDraft((current) => ({ ...current, objects: current.objects.filter((object) => object.key !== objectKey).map((object) => ({ ...object, fields: object.fields.filter((field) => field.targetObject !== objectKey) })) }));
    const nextObjectKey = draft.objects.find((object) => object.key !== objectKey)?.key ?? '';
    if (newField.objectKey === objectKey) setNewField((current) => ({ ...current, objectKey: nextObjectKey }));
    if (newRelation.objectKey === objectKey) setNewRelation((current) => ({ ...current, objectKey: nextObjectKey }));
    if (newRelation.targetObject === objectKey) setNewRelation((current) => ({ ...current, targetObject: nextObjectKey }));
    setError('');
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
        <fieldset className="application-model-draft-group">
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
        <fieldset className="application-model-draft-group">
          <legend>Ajouter un champ texte optionnel</legend>
          <p>Le champ sera disponible dans les formulaires de l’objet cible. Les champs, colonnes et enregistrements existants sont conservés.</p>
          <div className="application-form-grid">
            <label>Objet cible<select value={newField.objectKey} onChange={(event) => updateNewField('objectKey', event.target.value)}>{draft.objects.map((object) => <option key={object.key} value={object.key}>{object.pluralLabel} ({object.key})</option>)}</select></label>
            <label>Nom du champ<input value={newField.label} required maxLength={120} placeholder="Responsable" onChange={(event) => updateNewField('label', event.target.value)} /></label>
            <label>Clé du champ<input value={newField.key} maxLength={48} placeholder="Générée si vide" onChange={(event) => updateNewField('key', event.target.value)} /><small>Texte optionnel, 160 caractères maximum. Une clé déjà utilisée reçoit un suffixe.</small></label>
          </div>
          <button type="button" className="button secondary small" disabled={pending || !newField.objectKey || !newField.label.trim()} onClick={addField}>Ajouter le champ au brouillon</button>
        </fieldset>
        <fieldset className="application-model-draft-group">
          <legend>Ajouter une relation optionnelle</legend>
          <p>Les anciennes données peuvent laisser cette relation vide. Le serveur vérifiera le projet et le type de chaque enregistrement lié.</p>
          <div className="application-form-grid">
            <label>Objet source<select value={newRelation.objectKey} onChange={(event) => updateNewRelation('objectKey', event.target.value)}>{draft.objects.map((object) => <option key={object.key} value={object.key}>{object.pluralLabel} ({object.key})</option>)}</select></label>
            <label>Objet lié<select value={newRelation.targetObject} onChange={(event) => updateNewRelation('targetObject', event.target.value)}>{draft.objects.map((object) => <option key={object.key} value={object.key}>{object.pluralLabel} ({object.key})</option>)}</select></label>
            <label>Nom de la relation<input value={newRelation.label} required maxLength={120} placeholder="Filière secondaire" onChange={(event) => updateNewRelation('label', event.target.value)} /></label>
            <label>Clé de la relation<input value={newRelation.key} maxLength={48} placeholder="Générée si vide" onChange={(event) => updateNewRelation('key', event.target.value)} /><small>Relation optionnelle. Une clé déjà utilisée dans l’objet source reçoit un suffixe.</small></label>
          </div>
          <button type="button" className="button secondary small" disabled={pending || !newRelation.objectKey || !newRelation.targetObject || !newRelation.label.trim()} onClick={addRelation}>Ajouter la relation au brouillon</button>
        </fieldset>
      </div>
      <aside className="application-model-preview" aria-label="Aperçu du brouillon de modèle">
        <span className="status-pill">Brouillon non enregistré</span>
        <h3>{parsedDraft.success ? parsedDraft.data.name : 'Brouillon à corriger'}</h3>
        <p>{parsedDraft.success ? parsedDraft.data.description || 'Aucune description.' : 'Corrigez les champs avant l’enregistrement.'}</p>
        <div className="application-model-preview-metrics"><strong>{draft.objects.length} objets</strong><span>{parsedDraft.success ? routeCount : '—'} routes logiques</span></div>
        <ul>{draft.objects.map((object) => {
          const added = !originalKeys.has(object.key);
          const originalObject = model.objects.find((candidate) => candidate.key === object.key);
          const addedFields = object.fields.filter((field) => originalObject ? !originalObject.fields.some((candidate) => candidate.key === field.key) : field.key !== 'nom');
          return <li key={object.key}><div><strong>{object.pluralLabel}</strong><code>{object.key}</code><small className="application-model-object-meta">{object.fields.length} champ{object.fields.length > 1 ? 's' : ''}</small>{addedFields.length > 0 && <span className="application-model-added-fields">{addedFields.map((field) => <span key={field.key}>+ {field.label} <code>{field.key}</code>{field.type === 'relation' && <span className="application-model-relation-target">→ {field.targetObject}</span>}</span>)}</span>}</div>{added && <><span className="application-model-new-badge">Nouveau</span><button type="button" className="button ghost small" disabled={pending} aria-label={`Retirer ${object.pluralLabel} du brouillon`} onClick={() => removeObject(object.key)}>Retirer</button></>}</li>;
        })}</ul>
        <p className="application-model-permissions">Les grants existants sont conservés : les champs et relations ajoutés suivent les permissions de leur objet et aucun rôle ne reçoit implicitement un nouvel objet. L’enregistrement sera refusé si la version active n’est plus v{version}.</p>
      </aside>
    </div>
    {error && <p className="form-status" role="alert">{error}</p>}
    <div className="button-row"><button type="button" className="button coral small" disabled={pending || !dirty} onClick={() => void apply()}>{pending ? 'Enregistrement…' : 'Appliquer le brouillon'}</button><button type="button" className="button secondary small" disabled={pending} onClick={onCancel}>Annuler le brouillon</button></div>
  </section>;
}
