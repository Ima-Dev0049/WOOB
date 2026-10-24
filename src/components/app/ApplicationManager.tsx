'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client-api';
import {
  buildApplicationRoutes,
  roleCan,
  roleCanAction,
  type ApplicationField,
  type ApplicationModel,
  type ApplicationObject,
  type ApplicationOperation,
  type ApplicationRecordData,
  type WorkspaceRole,
} from '@/lib/application/model';
import { schoolApplicationModel } from '@/lib/application/school-model';

const PAGE_SIZE = 25;
const RELATION_OPTION_LIMIT = 100;

export type ManagedRecord = { id: string; objectKey: string; data: ApplicationRecordData; createdAt: string; updatedAt: string };
export type ManagedObjectData = { object: ApplicationObject; total: number; records: ManagedRecord[] };
type FormState = { objectKey: string; record?: ManagedRecord };

function pageFromParam(value: string | null): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed - 1 : 0;
}

export function ApplicationManager({ projectId, model, version, role, canManage, initialObjects }: {
  projectId: string;
  model: ApplicationModel | null;
  version: number;
  role: WorkspaceRole;
  canManage: boolean;
  initialObjects: ManagedObjectData[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const readableObjects = useMemo(() => model?.objects.filter((object) => roleCan(model, role, object.key, 'read')) ?? [], [model, role]);
  const [activeKey, setActiveKey] = useState(() => {
    const requested = searchParams.get('objet');
    return requested === 'routes' || readableObjects.some((object) => object.key === requested) ? requested! : readableObjects[0]?.key ?? 'routes';
  });
  const selectedKey = activeKey === 'routes' || readableObjects.some((object) => object.key === activeKey) ? activeKey : readableObjects[0]?.key ?? 'routes';
  const activeObject = model?.objects.find((object) => object.key === selectedKey);
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState(() => {
    const requested = searchParams.get('statut') ?? '';
    const status = activeObject?.statusField ? activeObject.fields.find((field) => field.key === activeObject.statusField) : undefined;
    return status?.options?.some((option) => option.value === requested) ? requested : '';
  });
  const [page, setPage] = useState(() => pageFromParam(searchParams.get('page')));
  const [records, setRecords] = useState<Record<string, ManagedRecord[]>>(() => Object.fromEntries(initialObjects.map((item) => [
    item.object.key,
    page === 0 && !search && !statusFilter ? item.records.slice(0, PAGE_SIZE) : [],
  ])));
  const [relationRecords, setRelationRecords] = useState<Record<string, ManagedRecord[]>>(() => Object.fromEntries(initialObjects.map((item) => [item.object.key, item.records])));
  const [totals, setTotals] = useState<Record<string, number>>(() => Object.fromEntries(initialObjects.map((item) => [item.object.key, item.total])));
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<FormState | null>(null);
  const routes = useMemo(() => model ? buildApplicationRoutes(model) : [], [model]);
  const baseUrl = `/api/projects/${projectId}/application`;
  const total = activeObject ? totals[activeObject.key] ?? 0 : 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const rangeStart = total ? currentPage * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(total, (currentPage + 1) * PAGE_SIZE);

  useEffect(() => {
    if (!activeObject || !readableObjects.some((object) => object.key === activeObject.key)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(currentPage * PAGE_SIZE) });
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      apiFetch<{ records: ManagedRecord[]; total: number }>(`${baseUrl}/objects/${activeObject.key}?${params}`, { signal: controller.signal })
        .then((result) => {
          setRecords((current) => ({ ...current, [activeObject.key]: result.records }));
          setTotals((current) => ({ ...current, [activeObject.key]: result.total }));
        })
        .catch((error: unknown) => { if (error instanceof Error && error.name !== 'AbortError') setMessage(errorMessage(error)); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeObject, baseUrl, currentPage, readableObjects, reloadKey, search, statusFilter]);

  useEffect(() => {
    if (!reloadKey) return;
    const controller = new AbortController();
    void Promise.all(readableObjects.map(async (object) => {
      const result = await apiFetch<{ records: ManagedRecord[] }>(`${baseUrl}/objects/${object.key}?limit=${RELATION_OPTION_LIMIT}&offset=0`, { signal: controller.signal });
      return [object.key, result.records] as const;
    })).then((entries) => {
      if (!controller.signal.aborted) setRelationRecords(Object.fromEntries(entries));
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name !== 'AbortError') setMessage('Les données sont enregistrées, mais les options de relation n’ont pas pu être actualisées.');
    });
    return () => controller.abort();
  }, [baseUrl, readableObjects, reloadKey]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('objet', selectedKey);
    if (selectedKey === 'routes') {
      url.searchParams.delete('q');
      url.searchParams.delete('statut');
      url.searchParams.delete('page');
    } else {
      if (search.trim()) url.searchParams.set('q', search.trim());
      else url.searchParams.delete('q');
      if (statusFilter) url.searchParams.set('statut', statusFilter);
      else url.searchParams.delete('statut');
      if (currentPage > 0) url.searchParams.set('page', String(currentPage + 1));
      else url.searchParams.delete('page');
    }
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [currentPage, search, selectedKey, statusFilter]);

  if (!model) return <section className="application-empty empty-state"><span className="eyebrow">Exécution gérée</span><h2>Aucun modèle d’application</h2><p>WOOB peut exécuter des objets, des formulaires et des processus validés sans générer un backend spécifique à ce site.</p>{canManage ? <><p>L’exemple ci-dessous est un modèle déterministe, pas une réponse présentée comme générée par une IA.</p><button className="button coral" disabled={pending} onClick={async () => {
    setPending(true); setMessage('');
    try {
      await apiFetch(baseUrl, { method: 'PUT', body: JSON.stringify({ model: schoolApplicationModel, baseVersion: null }) });
      router.refresh();
    } catch (error) { setMessage(errorMessage(error)); setPending(false); }
  }}>Initialiser un portail scolaire</button></> : <p>Un propriétaire ou un administrateur doit initialiser le modèle.</p>}{message && <p className="form-status" role="alert">{message}</p>}</section>;

  const can = (objectKey: string, operation: ApplicationOperation) => roleCan(model, role, objectKey, operation);
  const roleLabel = (key: WorkspaceRole) => model.roles.find((item) => item.key === key)?.label ?? key;
  const reload = () => setReloadKey((value) => value + 1);

  async function run(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setPending(true); setMessage('');
    try { await action(); setMessage(success); reload(); return true; }
    catch (error) { setMessage(errorMessage(error)); return false; }
    finally { setPending(false); }
  }

  function selectObject(objectKey: string) {
    setActiveKey(objectKey); setSearch(''); setStatusFilter(''); setPage(0); setForm(null); setMessage('');
  }

  function displayValue(object: ApplicationObject, field: ApplicationField, record: ManagedRecord): string {
    const value = record.data[field.key];
    if (value === undefined || value === null || value === '') return '—';
    if (field.type === 'boolean') return value === true ? 'Oui' : 'Non';
    if (field.type === 'enum') return field.options?.find((option) => option.value === value)?.label ?? String(value);
    if (field.type === 'relation') {
      const targetObject = model!.objects.find((candidate) => candidate.key === field.targetObject);
      const target = relationRecords[field.targetObject!]?.find((candidate) => candidate.id === value);
      const title = target?.data[targetObject?.titleField ?? ''];
      return typeof title === 'string' || typeof title === 'number' ? String(title) : 'Référence liée';
    }
    return String(value);
  }

  return <div className="application-manager">
    <div className="application-runtime-note"><span><strong>Serveur commun sécurisé</strong>Aucun backend ni schéma SQL généré par site.</span><span>Modèle v{version} · Rôle : {roleLabel(role)}</span></div>
    <nav className="application-tabs" aria-label="Objets et plan du modèle">
      {readableObjects.map((object) => <button key={object.key} className={selectedKey === object.key ? 'active' : ''} aria-current={selectedKey === object.key ? 'page' : undefined} onClick={() => selectObject(object.key)}>{object.pluralLabel}<span>{totals[object.key] ?? 0}</span></button>)}
      <button className={selectedKey === 'routes' ? 'active' : ''} aria-current={selectedKey === 'routes' ? 'page' : undefined} onClick={() => selectObject('routes')}>Routes &amp; droits<span>{routes.length}</span></button>
    </nav>
    {message && <p className="form-status" role="status">{message}</p>}

    {activeObject && readableObjects.some((object) => object.key === activeObject.key) && <section className="application-object">
      <header className="application-object-header"><div><h2>{activeObject.pluralLabel}</h2><p>{activeObject.description || `Enregistrements gérés par le modèle ${model.name}.`}</p></div>{can(activeObject.key, 'create') && <button className="button dark small" disabled={pending} onClick={() => setForm({ objectKey: activeObject.key })}>Ajouter : {activeObject.label}</button>}</header>
      <div className="application-filters">
        <label>Recherche<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder={`Rechercher dans ${activeObject.pluralLabel.toLowerCase()}`} aria-label={`Rechercher dans ${activeObject.pluralLabel}`} /></label>
        {activeObject.statusField && <label>Statut<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} aria-label="Filtrer par statut"><option value="">Tous les statuts</option>{activeObject.fields.find((field) => field.key === activeObject.statusField)?.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
        <span role="status" aria-atomic="true">{loading ? 'Actualisation…' : `${total} résultat${total > 1 ? 's' : ''}`}</span>
      </div>
      {form?.objectKey === activeObject.key && <ApplicationRecordForm key={`${form.objectKey}-${form.record?.id ?? 'new'}`} object={activeObject} record={form.record} records={relationRecords} model={model} pending={pending} onCancel={() => setForm(null)} onSubmit={async (data) => {
        const creating = !form.record;
        const saved = await run(() => apiFetch(form.record ? `${baseUrl}/objects/${activeObject.key}/${form.record!.id}` : `${baseUrl}/objects/${activeObject.key}`, { method: form.record ? 'PATCH' : 'POST', body: JSON.stringify({ data }) }), form.record ? 'Enregistrement modifié.' : 'Enregistrement créé.');
        if (saved) { setForm(null); if (creating) setPage(0); }
      }} />}
      <ApplicationRecordTable
        object={activeObject} model={model} role={role} records={records[activeObject.key] ?? []} loading={loading}
        displayValue={displayValue} pending={pending}
        onEdit={(record) => setForm({ objectKey: activeObject.key, record })}
        onDelete={async (record) => {
          const title = displayValue(activeObject, activeObject.fields.find((field) => field.key === activeObject.titleField)!, record);
          if (!window.confirm(`Supprimer « ${title} » de ${activeObject.pluralLabel} ?`)) return;
          await run(() => apiFetch(`${baseUrl}/objects/${activeObject.key}/${record.id}`, { method: 'DELETE' }), 'Enregistrement supprimé.');
        }}
        onAction={async (record, actionKey, actionLabel) => {
          if (!window.confirm(`${actionLabel} : ${activeObject.label} ?`)) return;
          await run(() => apiFetch(`${baseUrl}/objects/${activeObject.key}/${record.id}/actions/${actionKey}`, { method: 'POST', body: JSON.stringify({}) }), `Action « ${actionLabel} » appliquée.`);
        }}
      />
      {total > 0 && <nav className="application-pagination" aria-label={`Pagination ${activeObject.pluralLabel}`}>
        <p><strong>Page {currentPage + 1} / {pageCount}</strong><span>{rangeStart}–{rangeEnd} sur {total}</span></p>
        <div><button className="button secondary small" disabled={loading || currentPage === 0} onClick={() => { setPage(currentPage - 1); setForm(null); }}>Précédent</button><button className="button secondary small" disabled={loading || currentPage >= pageCount - 1} onClick={() => { setPage(currentPage + 1); setForm(null); }}>Suivant</button></div>
      </nav>}
    </section>}

    {selectedKey === 'routes' && <section className="application-routes"><header><div><h2>Plan d’exécution et permissions</h2><p>Chaque opération est déduite du modèle actif, puis contrôlée à nouveau côté serveur.</p></div><span className="status-pill">{routes.length} routes logiques</span></header><div className="application-route-list">{routes.map((route) => <article key={route.id}><span className={`http-method ${route.method.toLowerCase()}`}>{route.method}</span><div><strong>{route.label}</strong><code>{route.id}</code></div><p>{route.roles.length ? route.roles.map(roleLabel).join(', ') : 'Aucun rôle autorisé'}</p></article>)}</div><p className="application-api-note">Les routes techniques restent internes et authentifiées. Aucune API publique, clé d’accès, redirection personnalisée ou publication de ces objets n’est activée dans ce lot.</p></section>}
    {!readableObjects.length && selectedKey !== 'routes' && <div className="empty-state"><p>Votre rôle ne possède aucun droit de lecture sur ce modèle.</p></div>}
  </div>;
}

function ApplicationRecordTable({ object, model, role, records, loading, displayValue, pending, onEdit, onDelete, onAction }: {
  object: ApplicationObject;
  model: ApplicationModel;
  role: WorkspaceRole;
  records: ManagedRecord[];
  loading: boolean;
  displayValue: (object: ApplicationObject, field: ApplicationField, record: ManagedRecord) => string;
  pending: boolean;
  onEdit: (record: ManagedRecord) => void;
  onDelete: (record: ManagedRecord) => Promise<void>;
  onAction: (record: ManagedRecord, actionKey: string, actionLabel: string) => Promise<void>;
}) {
  const titleField = object.fields.find((field) => field.key === object.titleField)!;
  const columns = (object.columns ?? [object.titleField, ...object.fields.map((field) => field.key)]).filter((key, index, values) => values.indexOf(key) === index).slice(0, 6).map((key) => object.fields.find((field) => field.key === key)!).filter(Boolean);
  return <div className="application-table-wrap" aria-busy={loading}><table className="application-table"><caption>{object.pluralLabel} gérés par le modèle</caption><thead><tr>{columns.map((field) => <th key={field.key} scope="col">{field.label}</th>)}<th scope="col">Actions</th></tr></thead><tbody>{records.map((record) => {
    const status = object.statusField ? record.data[object.statusField] : undefined;
    const actions = object.actions.filter((action) => typeof status === 'string' && action.from.includes(status) && roleCanAction(model, role, object.key, action.key));
    const title = displayValue(object, titleField, record);
    return <tr key={record.id}>{columns.map((field) => <td key={field.key} data-label={field.label}>{field.key === object.statusField ? <span className="application-status">{displayValue(object, field, record)}</span> : displayValue(object, field, record)}</td>)}<td className="application-row-actions" data-label="Actions">{actions.map((action) => <button key={action.key} className="button secondary small" disabled={pending} aria-label={`${action.label} : ${title}`} onClick={() => void onAction(record, action.key, action.label)}>{action.label}</button>)}{roleCan(model, role, object.key, 'update') && <button className="button ghost small" disabled={pending} aria-label={`Modifier : ${title}`} onClick={() => onEdit(record)}>Modifier</button>}{roleCan(model, role, object.key, 'delete') && <button className="button ghost small danger" disabled={pending} aria-label={`Supprimer : ${title}`} onClick={() => void onDelete(record)}>Supprimer</button>}{!actions.length && !roleCan(model, role, object.key, 'update') && !roleCan(model, role, object.key, 'delete') && <span>Lecture seule</span>}</td></tr>;
  })}{!records.length && <tr className="application-empty-row"><td colSpan={columns.length + 1}><div className="application-no-results">{loading ? 'Chargement des enregistrements…' : 'Aucun enregistrement ne correspond à ces critères.'}</div></td></tr>}</tbody></table></div>;
}

function ApplicationRecordForm({ object, model, record, records, pending, onCancel, onSubmit }: {
  object: ApplicationObject;
  model: ApplicationModel;
  record?: ManagedRecord | undefined;
  records: Record<string, ManagedRecord[]>;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: ApplicationRecordData) => Promise<void>;
}) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const data: ApplicationRecordData = {};
    for (const field of object.fields) {
      if (field.key === object.statusField) continue;
      const raw = values.get(field.key);
      if (field.type === 'boolean') { data[field.key] = raw === 'on'; continue; }
      if ((raw === null || raw === '') && !field.required) continue;
      if (field.type === 'integer' || field.type === 'number') data[field.key] = Number(raw);
      else data[field.key] = String(raw ?? '');
    }
    await onSubmit(data);
  }
  return <form className="application-record-form" onSubmit={submit}><header><h3>{record ? `Modifier : ${object.label}` : `Ajouter : ${object.label}`}</h3><button type="button" className="button ghost small" onClick={onCancel}>Fermer</button></header><div className="application-form-grid">{object.fields.filter((field) => field.key !== object.statusField).map((field) => <ApplicationFieldInput key={field.key} field={field} object={object} model={model} record={record} records={records} />)}</div>{object.statusField && <p className="field-hint">Le statut initial et ses changements sont contrôlés par les actions du processus, jamais par ce formulaire.</p>}<div className="button-row"><button className="button coral small" disabled={pending}>{record ? 'Enregistrer les modifications' : 'Créer l’enregistrement'}</button><button type="button" className="button secondary small" onClick={onCancel}>Annuler</button></div></form>;
}

function ApplicationFieldInput({ field, object, model, record, records }: { field: ApplicationField; object: ApplicationObject; model: ApplicationModel; record?: ManagedRecord | undefined; records: Record<string, ManagedRecord[]> }) {
  const id = `application-${object.key}-${field.key}`;
  const value = record?.data[field.key] ?? field.defaultValue;
  const common = { id, name: field.key, required: field.required, 'aria-describedby': field.help ? `${id}-help` : undefined };
  const label = <>{field.label}{field.required && <span aria-hidden="true"> *</span>}</>;
  const help = field.help && <small id={`${id}-help`}>{field.help}</small>;
  if (field.type === 'boolean') return <label className="application-checkbox" htmlFor={id}>{label}<input {...common} type="checkbox" defaultChecked={value === true} />{help}</label>;
  if (field.type === 'textarea') return <label htmlFor={id}>{label}<textarea {...common} rows={4} maxLength={field.maxLength ?? 10_000} defaultValue={typeof value === 'string' ? value : ''} />{help}</label>;
  if (field.type === 'enum') return <label htmlFor={id}>{label}<select {...common} defaultValue={typeof value === 'string' ? value : ''}>{!field.required && <option value="">Non renseigné</option>}{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{help}</label>;
  if (field.type === 'relation') {
    const targetObject = model.objects.find((candidate) => candidate.key === field.targetObject);
    const options = records[field.targetObject!] ?? [];
    return <label htmlFor={id}>{label}<select {...common} defaultValue={typeof value === 'string' ? value : ''}><option value="" disabled={field.required}>Sélectionner : {targetObject?.label ?? field.targetObject}</option>{options.map((option) => <option key={option.id} value={option.id}>{String(option.data[targetObject?.titleField ?? ''] ?? option.id)}</option>)}</select>{help}{!options.length && <small>Ajoutez d’abord un enregistrement dans {targetObject?.pluralLabel ?? field.targetObject}.</small>}</label>;
  }
  const type = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'integer' || field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
  return <label htmlFor={id}>{label}<input {...common} type={type} maxLength={['text', 'email', 'phone'].includes(field.type) ? field.maxLength : undefined} min={field.min} max={field.max} step={field.type === 'number' ? 'any' : undefined} defaultValue={typeof value === 'string' || typeof value === 'number' ? value : ''} />{help}</label>;
}
