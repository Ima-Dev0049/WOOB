'use client';

import { useMemo, useRef, useState } from 'react';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { ApplicationModelCanvas, applicationCanvasPointAt, initialApplicationCanvasPositions } from './ApplicationModelCanvas';
import { addApplicationTransition, addOptionalApplicationEnumField, addOptionalApplicationRelationField, addOptionalApplicationTypedField, addSimpleApplicationObject, applicationFieldTypeLabels, setApplicationObjectColumns, type ApplicationRelationFieldInput, type ApplicationTextFieldInput, type ApplicationTransitionInput, type ApplicationTypedFieldInput, type SimpleApplicationObjectInput } from '@/lib/application/model-editor';
import { applicationColumnKeys, applicationModelSchema, buildApplicationRoutes, type ApplicationModel } from '@/lib/application/model';

const emptyObject: SimpleApplicationObjectInput = { label: '', pluralLabel: '', key: '', description: '' };
const emptyFieldBounds = { min: '', max: '' };
const optionalFieldTypes = [
  { value: 'text', label: applicationFieldTypeLabels.text, help: 'Texte optionnel, 160 caractères maximum.' },
  { value: 'integer', label: applicationFieldTypeLabels.integer, help: 'Nombre entier optionnel, sans décimale.' },
  { value: 'number', label: applicationFieldTypeLabels.number, help: 'Nombre optionnel, décimales autorisées.' },
  { value: 'date', label: applicationFieldTypeLabels.date, help: 'Date optionnelle au format AAAA-MM-JJ.' },
] satisfies ReadonlyArray<{ value: ApplicationTypedFieldInput['type']; label: string; help: string }>;

function transitionDefaults(object: ApplicationModel['objects'][number] | undefined) {
  const options = object?.fields.find((field) => field.key === object.statusField)?.options ?? [];
  return { from: options[0]?.value ?? '', to: options[1]?.value ?? options[0]?.value ?? '' };
}

function initialTransition(model: ApplicationModel): ApplicationTransitionInput {
  const object = model.objects.find((candidate) => candidate.statusField);
  return { objectKey: object?.key ?? '', label: '', key: '', ...transitionDefaults(object) };
}

export function ApplicationModelEditor({ model, version, baseUrl, onApplied, onCancel }: {
  model: ApplicationModel;
  version: number;
  baseUrl: string;
  onApplied: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ApplicationModel>(() => structuredClone(model));
  const [newObject, setNewObject] = useState<SimpleApplicationObjectInput>(emptyObject);
  const [newField, setNewField] = useState<ApplicationTypedFieldInput>(() => ({ objectKey: model.objects[0]?.key ?? '', label: '', key: '', type: 'text' }));
  const [fieldBounds, setFieldBounds] = useState(emptyFieldBounds);
  const [fieldDefault, setFieldDefault] = useState('');
  const [newEnumField, setNewEnumField] = useState<ApplicationTextFieldInput>(() => ({ objectKey: model.objects[0]?.key ?? '', label: '', key: '' }));
  const [enumOptions, setEnumOptions] = useState('');
  const [newRelation, setNewRelation] = useState<ApplicationRelationFieldInput>(() => ({ objectKey: model.objects[0]?.key ?? '', targetObject: model.objects[0]?.key ?? '', label: '', key: '' }));
  const [newTransition, setNewTransition] = useState<ApplicationTransitionInput>(() => initialTransition(model));
  const [columnObjectKey, setColumnObjectKey] = useState(model.objects[0]?.key ?? '');
  const [canvasPositions, setCanvasPositions] = useState(() => initialApplicationCanvasPositions(model.objects));
  const [selectedObjectKey, setSelectedObjectKey] = useState(model.objects[0]?.key ?? '');
  const [relationSource, setRelationSource] = useState<string | null>(null);
  const objectLabelRef = useRef<HTMLInputElement>(null);
  const fieldLabelRef = useRef<HTMLInputElement>(null);
  const relationLabelRef = useRef<HTMLInputElement>(null);
  const transitionLabelRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const parsedDraft = useMemo(() => applicationModelSchema.safeParse(draft), [draft]);
  const routeCount = parsedDraft.success ? buildApplicationRoutes(parsedDraft.data).length : 0;
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(model), [draft, model]);
  const originalKeys = useMemo(() => new Set(model.objects.map((object) => object.key)), [model]);
  const transitionObject = draft.objects.find((object) => object.key === newTransition.objectKey);
  const transitionStatuses = transitionObject?.fields.find((field) => field.key === transitionObject.statusField)?.options ?? [];
  const columnObject = draft.objects.find((object) => object.key === columnObjectKey);
  const columnKeys = columnObject ? applicationColumnKeys(columnObject) : [];
  const columnFields = columnObject ? columnKeys.flatMap((key) => {
    const field = columnObject.fields.find((candidate) => candidate.key === key);
    return field ? [field] : [];
  }) : [];
  const availableColumnFields = columnObject?.fields.filter((field) => !columnKeys.includes(field.key)) ?? [];
  const enumOptionLabels = enumOptions.split('\n').map((option) => option.trim()).filter((option) => option.length > 0);
  const numericField = newField.type === 'integer' || newField.type === 'number';

  function updateNewObject(field: keyof SimpleApplicationObjectInput, value: string) {
    setNewObject((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function updateNewField(field: keyof ApplicationTextFieldInput, value: string) {
    setNewField((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function updateNewFieldType(type: ApplicationTypedFieldInput['type']) {
    setNewField((current) => ({ ...current, type }));
    setFieldBounds(emptyFieldBounds);
    setFieldDefault('');
    setError('');
  }

  function updateFieldBounds(field: keyof typeof emptyFieldBounds, value: string) {
    setFieldBounds((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function updateFieldDefault(value: string) {
    setFieldDefault(value);
    setError('');
  }

  function updateNewEnumField(field: keyof ApplicationTextFieldInput, value: string) {
    setNewEnumField((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function selectCanvasObject(objectKey: string) {
    setSelectedObjectKey(objectKey);
    if (relationSource) {
      setNewRelation((current) => ({ ...current, objectKey: relationSource, targetObject: objectKey }));
      setRelationSource(null);
      relationLabelRef.current?.focus();
    }
    setError('');
  }

  function addFieldFromCanvas(objectKey: string) {
    setSelectedObjectKey(objectKey);
    setNewField((current) => ({ ...current, objectKey }));
    setError('');
    fieldLabelRef.current?.focus();
  }

  function beginCanvasRelation(objectKey: string) {
    setSelectedObjectKey(objectKey);
    setRelationSource(objectKey);
    setNewRelation((current) => ({ ...current, objectKey }));
    setError('');
  }

  function selectTransitionObject(objectKey: string) {
    const object = draft.objects.find((candidate) => candidate.key === objectKey);
    setNewTransition((current) => ({ ...current, objectKey, ...transitionDefaults(object) }));
    setError('');
  }

  function addTransitionFromCanvas(objectKey: string) {
    setSelectedObjectKey(objectKey);
    selectTransitionObject(objectKey);
    transitionLabelRef.current?.focus();
  }

  function updateNewTransition(field: Exclude<keyof ApplicationTransitionInput, 'objectKey'>, value: string) {
    setNewTransition((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function updateNewRelation(field: keyof ApplicationRelationFieldInput, value: string) {
    setRelationSource(null);
    setNewRelation((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function addObject() {
    try {
      const next = addSimpleApplicationObject(draft, newObject);
      const added = next.objects.at(-1)!;
      setDraft(next);
      setCanvasPositions((current) => ({ ...current, [added.key]: applicationCanvasPointAt(next.objects.length - 1) }));
      setSelectedObjectKey(added.key);
      setNewObject(emptyObject);
      setError('');
    } catch {
      setError('Impossible d’ajouter cet objet. Vérifiez les noms, la clé technique et les limites du modèle.');
    }
  }

  function addField() {
    try {
      const numericSettings = numericField ? {
        ...(fieldBounds.min.trim() ? { min: Number(fieldBounds.min) } : {}),
        ...(fieldBounds.max.trim() ? { max: Number(fieldBounds.max) } : {}),
        ...(fieldDefault.trim() ? { defaultValue: Number(fieldDefault) } : {}),
      } : {};
      const next = addOptionalApplicationTypedField(draft, { ...newField, ...numericSettings });
      setDraft(next);
      setNewField((current) => ({ ...current, label: '', key: '' }));
      setFieldBounds(emptyFieldBounds);
      setFieldDefault('');
      setError('');
    } catch {
      setError('Impossible d’ajouter ce champ. Vérifiez l’objet cible, le nom, les bornes, la valeur par défaut et les limites du modèle.');
    }
  }

  function addEnumField() {
    try {
      const next = addOptionalApplicationEnumField(draft, { ...newEnumField, options: enumOptionLabels });
      setDraft(next);
      setNewEnumField((current) => ({ ...current, label: '', key: '' }));
      setEnumOptions('');
      setError('');
    } catch {
      setError('Impossible d’ajouter cette liste. Vérifiez son nom et utilisez de 2 à 40 options non vides avec des libellés uniques.');
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

  function addTransition() {
    try {
      const next = addApplicationTransition(draft, newTransition);
      setDraft(next);
      setNewTransition((current) => ({ ...current, label: '', key: '' }));
      setError('');
    } catch {
      setError('Impossible d’ajouter cette transition. Vérifiez le nom, les statuts et les limites du processus.');
    }
  }

  function updateColumns(columns: string[]) {
    try {
      setDraft(setApplicationObjectColumns(draft, { objectKey: columnObjectKey, columns }));
      setError('');
    } catch {
      setError('Impossible de configurer ces colonnes. Choisissez de 1 à 12 champs distincts appartenant à cet objet.');
    }
  }

  function toggleColumn(fieldKey: string, visible: boolean) {
    updateColumns(visible ? [...columnKeys, fieldKey] : columnKeys.filter((key) => key !== fieldKey));
  }

  function moveColumn(fieldKey: string, direction: -1 | 1) {
    const index = columnKeys.indexOf(fieldKey);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= columnKeys.length) return;
    const next = [...columnKeys];
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    updateColumns(next);
  }

  function removeObject(objectKey: string) {
    setDraft((current) => ({ ...current, objects: current.objects.filter((object) => object.key !== objectKey).map((object) => {
      const fields = object.fields.filter((field) => field.targetObject !== objectKey);
      if (!object.columns) return { ...object, fields };
      const columns = object.columns.filter((key) => fields.some((field) => field.key === key));
      return { ...object, fields, columns: columns.length ? columns : [object.titleField] };
    }) }));
    const nextObjectKey = draft.objects.find((object) => object.key !== objectKey)?.key ?? '';
    setCanvasPositions((current) => { const next = { ...current }; delete next[objectKey]; return next; });
    if (selectedObjectKey === objectKey) setSelectedObjectKey(nextObjectKey);
    if (relationSource === objectKey) setRelationSource(null);
    if (newField.objectKey === objectKey) setNewField((current) => ({ ...current, objectKey: nextObjectKey }));
    if (newEnumField.objectKey === objectKey) setNewEnumField((current) => ({ ...current, objectKey: nextObjectKey }));
    if (newRelation.objectKey === objectKey) setNewRelation((current) => ({ ...current, objectKey: nextObjectKey }));
    if (newRelation.targetObject === objectKey) setNewRelation((current) => ({ ...current, targetObject: nextObjectKey }));
    if (columnObjectKey === objectKey) setColumnObjectKey(nextObjectKey);
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
    <ApplicationModelCanvas
      objects={draft.objects}
      originalKeys={originalKeys}
      positions={canvasPositions}
      selectedKey={selectedObjectKey}
      relationSource={relationSource}
      pending={pending}
      onSelect={selectCanvasObject}
      onMove={(objectKey, point) => setCanvasPositions((current) => ({ ...current, [objectKey]: point }))}
      onAddObject={() => objectLabelRef.current?.focus()}
      onAddField={addFieldFromCanvas}
      onAddAction={addTransitionFromCanvas}
      onBeginRelation={beginCanvasRelation}
      onCancelRelation={() => setRelationSource(null)}
      onResetLayout={() => setCanvasPositions(initialApplicationCanvasPositions(draft.objects))}
    />
    <div className="application-model-editor-layout">
      <div className="application-model-editor-controls">
        <h3 className="application-model-inspector-title">Inspecteur structuré</h3>
        <div className="application-form-grid">
          <label>Nom du modèle<input value={draft.name} required maxLength={120} onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); setError(''); }} /></label>
          <label>Description du modèle<textarea rows={3} maxLength={500} value={draft.description} onChange={(event) => { setDraft((current) => ({ ...current, description: event.target.value })); setError(''); }} /></label>
        </div>
        <fieldset className="application-model-draft-group">
          <legend>Ajouter un objet simple</legend>
          <p>Le nouvel objet contient un champ « Nom » requis. Les champs, processus et relations existants ne sont pas modifiés.</p>
          <div className="application-form-grid">
            <label>Nom singulier<input ref={objectLabelRef} value={newObject.label} required maxLength={120} placeholder="Club" onChange={(event) => updateNewObject('label', event.target.value)} /></label>
            <label>Nom pluriel<input value={newObject.pluralLabel} required maxLength={120} placeholder="Clubs" onChange={(event) => updateNewObject('pluralLabel', event.target.value)} /></label>
            <label>Clé technique<input value={newObject.key} maxLength={48} placeholder="Générée si vide" onChange={(event) => updateNewObject('key', event.target.value)} /><small>Minuscules, chiffres et tirets ; une clé déjà utilisée reçoit un suffixe.</small></label>
            <label>Description de l’objet<textarea rows={3} maxLength={300} value={newObject.description} onChange={(event) => updateNewObject('description', event.target.value)} /></label>
          </div>
          <button type="button" className="button secondary small" disabled={pending || !newObject.label.trim() || !newObject.pluralLabel.trim()} onClick={addObject}>Ajouter l’objet au brouillon</button>
        </fieldset>
        <fieldset className="application-model-draft-group">
          <legend>Ajouter un champ optionnel</legend>
          <p>Le champ sera disponible dans les formulaires de l’objet cible. Les champs, colonnes et enregistrements existants sont conservés.</p>
          <div className="application-form-grid">
            <label>Objet cible<select value={newField.objectKey} onChange={(event) => updateNewField('objectKey', event.target.value)}>{draft.objects.map((object) => <option key={object.key} value={object.key}>{object.pluralLabel} ({object.key})</option>)}</select></label>
            <label>Type de champ<select value={newField.type} onChange={(event) => updateNewFieldType(event.target.value as ApplicationTypedFieldInput['type'])}>{optionalFieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <label>Nom du champ<input ref={fieldLabelRef} value={newField.label} required maxLength={120} placeholder="Responsable" onChange={(event) => updateNewField('label', event.target.value)} /></label>
            <label>Clé du champ<input value={newField.key} maxLength={48} placeholder="Générée si vide" onChange={(event) => updateNewField('key', event.target.value)} /><small>{optionalFieldTypes.find((type) => type.value === newField.type)?.help} Une clé déjà utilisée reçoit un suffixe.</small></label>
            {numericField && <>
              <label>Borne minimale<input type="number" step={newField.type === 'integer' ? 1 : 'any'} value={fieldBounds.min} placeholder="Aucune" onChange={(event) => updateFieldBounds('min', event.target.value)} /><small>Laissez vide pour ne pas définir de minimum.</small></label>
              <label>Borne maximale<input type="number" step={newField.type === 'integer' ? 1 : 'any'} value={fieldBounds.max} placeholder="Aucune" onChange={(event) => updateFieldBounds('max', event.target.value)} /><small>Le minimum ne peut pas dépasser le maximum.</small></label>
              <label>Valeur par défaut<input type="number" step={newField.type === 'integer' ? 1 : 'any'} value={fieldDefault} placeholder="Aucune" onChange={(event) => updateFieldDefault(event.target.value)} /><small>Appliquée à la création si le champ est omis, sans remplir les anciens enregistrements. Elle doit respecter les bornes.</small></label>
            </>}
          </div>
          <button type="button" className="button secondary small" disabled={pending || !newField.objectKey || !newField.label.trim()} onClick={addField}>Ajouter le champ au brouillon</button>
        </fieldset>
        <fieldset className="application-model-draft-group">
          <legend>Ajouter une liste de choix optionnelle</legend>
          <p>Ce champ enum reste distinct du statut de processus. Les anciennes données peuvent le laisser vide et les colonnes existantes ne changent pas automatiquement.</p>
          <div className="application-form-grid">
            <label>Objet de la liste<select value={newEnumField.objectKey} onChange={(event) => updateNewEnumField('objectKey', event.target.value)}>{draft.objects.map((object) => <option key={object.key} value={object.key}>{object.pluralLabel} ({object.key})</option>)}</select></label>
            <label>Nom de la liste<input value={newEnumField.label} required maxLength={120} placeholder="Niveau d’études" onChange={(event) => updateNewEnumField('label', event.target.value)} /></label>
            <label>Clé de la liste<input value={newEnumField.key} maxLength={48} placeholder="Générée si vide" onChange={(event) => updateNewEnumField('key', event.target.value)} /><small>Une clé de champ déjà utilisée reçoit un suffixe.</small></label>
            <label>Options de la liste<textarea rows={4} maxLength={6000} value={enumOptions} placeholder={'Licence\nMaster\nDoctorat'} onChange={(event) => { setEnumOptions(event.target.value); setError(''); }} /><small>Une option par ligne, de 2 à 40. Les lignes vides sont ignorées, les libellés doivent être uniques et les clés techniques sont générées avec suffixe de collision.</small></label>
          </div>
          <button type="button" className="button secondary small" disabled={pending || !newEnumField.objectKey || !newEnumField.label.trim() || enumOptionLabels.length < 2} onClick={addEnumField}>Ajouter la liste au brouillon</button>
        </fieldset>
        <fieldset className="application-model-draft-group">
          <legend>Ajouter une relation optionnelle</legend>
          <p>Les anciennes données peuvent laisser cette relation vide. Le serveur vérifiera le projet et le type de chaque enregistrement lié.</p>
          <div className="application-form-grid">
            <label>Objet source<select value={newRelation.objectKey} onChange={(event) => updateNewRelation('objectKey', event.target.value)}>{draft.objects.map((object) => <option key={object.key} value={object.key}>{object.pluralLabel} ({object.key})</option>)}</select></label>
            <label>Objet lié<select value={newRelation.targetObject} onChange={(event) => updateNewRelation('targetObject', event.target.value)}>{draft.objects.map((object) => <option key={object.key} value={object.key}>{object.pluralLabel} ({object.key})</option>)}</select></label>
            <label>Nom de la relation<input ref={relationLabelRef} value={newRelation.label} required maxLength={120} placeholder="Filière secondaire" onChange={(event) => updateNewRelation('label', event.target.value)} /></label>
            <label>Clé de la relation<input value={newRelation.key} maxLength={48} placeholder="Générée si vide" onChange={(event) => updateNewRelation('key', event.target.value)} /><small>Relation optionnelle. Une clé déjà utilisée dans l’objet source reçoit un suffixe.</small></label>
          </div>
          <button type="button" className="button secondary small" disabled={pending || !newRelation.objectKey || !newRelation.targetObject || !newRelation.label.trim()} onClick={addRelation}>Ajouter la relation au brouillon</button>
        </fieldset>
        <fieldset className="application-model-draft-group">
          <legend>Configurer les colonnes du tableau</legend>
          <p>Choisissez de 1 à 12 colonnes et leur ordre pour cet objet. Masquer une colonne ne supprime ni le champ, ni sa valeur, ni sa présence dans les formulaires.</p>
          <div className="application-form-grid">
            <label>Objet du tableau<select disabled={pending} value={columnObjectKey} onChange={(event) => { setColumnObjectKey(event.target.value); setError(''); }}>{draft.objects.map((object) => <option key={object.key} value={object.key}>{object.pluralLabel} ({object.key})</option>)}</select></label>
          </div>
          <div className="application-model-columns-section">
            <strong>Colonnes affichées, dans l’ordre</strong>
            <ol className="application-model-columns-list" aria-label={`Colonnes affichées de ${columnObject?.pluralLabel ?? 'l’objet'}`}>{columnFields.map((field, index) => <li key={field.key}>
              <span className="application-model-column-position" aria-hidden="true">{index + 1}</span>
              <label><input type="checkbox" checked disabled={pending} onChange={(event) => toggleColumn(field.key, event.target.checked)} /><span>Afficher la colonne {field.label}</span></label>
              <code>{field.key}</code>
              <div className="application-model-column-actions"><button type="button" className="button ghost small" disabled={pending || index === 0} aria-label={`Monter la colonne ${field.label}`} onClick={() => moveColumn(field.key, -1)}>Monter</button><button type="button" className="button ghost small" disabled={pending || index === columnFields.length - 1} aria-label={`Descendre la colonne ${field.label}`} onClick={() => moveColumn(field.key, 1)}>Descendre</button></div>
            </li>)}</ol>
          </div>
          <div className="application-model-columns-section">
            <strong>Champs disponibles</strong>
            {availableColumnFields.length > 0 ? <ul className="application-model-columns-list" aria-label={`Champs disponibles pour ${columnObject?.pluralLabel ?? 'l’objet'}`}>{availableColumnFields.map((field) => <li key={field.key}>
              <label><input type="checkbox" checked={false} disabled={pending || columnKeys.length >= 12} onChange={(event) => toggleColumn(field.key, event.target.checked)} /><span>Afficher la colonne {field.label}</span></label>
              <code>{field.key}</code><small>{applicationFieldTypeLabels[field.type]}</small>
            </li>)}</ul> : <p>Tous les champs de cet objet sont affichés.</p>}
          </div>
        </fieldset>
        <fieldset className="application-model-draft-group">
          <legend>Ajouter une transition de processus</legend>
          <p>Ajoutez une transition à source unique entre deux statuts existants. Les grants explicites ne sont pas élargis ; les grants d’action * conservent leur effet.</p>
          <div className="application-form-grid">
            <label>Objet du processus<select value={newTransition.objectKey} onChange={(event) => selectTransitionObject(event.target.value)}>{draft.objects.filter((object) => object.statusField).map((object) => <option key={object.key} value={object.key}>{object.pluralLabel} ({object.key})</option>)}</select></label>
            <label>Nom de la transition<input ref={transitionLabelRef} value={newTransition.label} required maxLength={120} placeholder="Rouvrir le dossier" onChange={(event) => updateNewTransition('label', event.target.value)} /></label>
            <label>Statut source<select value={newTransition.from} onChange={(event) => updateNewTransition('from', event.target.value)}>{transitionStatuses.map((status) => <option key={status.value} value={status.value}>{status.label} ({status.value})</option>)}</select></label>
            <label>Statut cible<select value={newTransition.to} onChange={(event) => updateNewTransition('to', event.target.value)}>{transitionStatuses.map((status) => <option key={status.value} value={status.value}>{status.label} ({status.value})</option>)}</select></label>
            <label>Clé de la transition<input value={newTransition.key} maxLength={48} placeholder="Générée si vide" onChange={(event) => updateNewTransition('key', event.target.value)} /><small>Une clé déjà utilisée dans ce processus reçoit un suffixe. La source doit différer de la cible.</small></label>
          </div>
          <button type="button" className="button secondary small" disabled={pending || !newTransition.objectKey || !newTransition.label.trim() || !newTransition.from || !newTransition.to || newTransition.from === newTransition.to} onClick={addTransition}>Ajouter la transition au brouillon</button>
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
          const addedActions = object.actions.filter((action) => !originalObject?.actions.some((candidate) => candidate.key === action.key));
          return <li key={object.key}><div><strong>{object.pluralLabel}</strong><code>{object.key}</code><small className="application-model-object-meta">{object.fields.length} champ{object.fields.length > 1 ? 's' : ''}</small><small className="application-model-object-columns">Colonnes : {applicationColumnKeys(object).join(' → ')}</small>{addedFields.length > 0 && <span className="application-model-added-fields">{addedFields.map((field) => <span key={field.key}>+ {field.label} <code>{field.key}</code><span className="application-model-field-type">{applicationFieldTypeLabels[field.type]}</span>{(field.type === 'integer' || field.type === 'number') && (field.min !== undefined || field.max !== undefined) && <span className="application-model-field-constraints">Min. {field.min ?? '—'} · Max. {field.max ?? '—'}</span>}{(field.type === 'integer' || field.type === 'number') && field.defaultValue !== undefined && <span className="application-model-field-constraints">Défaut : {String(field.defaultValue)}</span>}{field.type === 'relation' && <span className="application-model-relation-target">→ {field.targetObject}</span>}{field.type === 'enum' && <span className="application-model-relation-target">Options : {field.options?.map((option) => option.label).join(', ')}</span>}</span>)}</span>}{addedActions.length > 0 && <span className="application-model-added-fields">{addedActions.map((action) => <span key={action.key}>↳ {action.label} <code>{action.key}</code><span className="application-model-field-type">Transition</span><span className="application-model-relation-target">{action.from.join(', ')} → {action.to}</span></span>)}</span>}</div>{added && <><span className="application-model-new-badge">Nouveau</span><button type="button" className="button ghost small" disabled={pending} aria-label={`Retirer ${object.pluralLabel} du brouillon`} onClick={() => removeObject(object.key)}>Retirer</button></>}</li>;
        })}</ul>
        <p className="application-model-permissions">Les grants existants sont conservés sans élargissement : les ajouts utilisent les permissions de leur objet, seuls les grants d’action * couvrent automatiquement une nouvelle transition et aucun rôle ne reçoit implicitement un nouvel objet. L’enregistrement sera refusé si la version active n’est plus v{version}.</p>
      </aside>
    </div>
    {error && <p className="form-status" role="alert">{error}</p>}
    <div className="button-row"><button type="button" className="button coral small" disabled={pending || !dirty} onClick={() => void apply()}>{pending ? 'Enregistrement…' : 'Appliquer le brouillon'}</button><button type="button" className="button secondary small" disabled={pending} onClick={onCancel}>Annuler le brouillon</button></div>
  </section>;
}
