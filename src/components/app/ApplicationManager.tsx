'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client-api';
import {
  applicationColumnKeys,
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
import { managedApplicationTemplates } from '@/lib/application/templates';
import type { ApplicationSummary } from '@/lib/application/summary';
import { ApplicationModelEditor } from './ApplicationModelEditor';

const PAGE_SIZE = 25;
const RELATION_OPTION_LIMIT = 100;
const RELATION_SEARCH_LIMIT = 50;
const RELATION_CACHE_LIMIT = 250;

export type ManagedRecord = { id: string; objectKey: string; data: ApplicationRecordData; createdAt: string; updatedAt: string };
export type ManagedObjectData = { object: ApplicationObject; total: number; records: ManagedRecord[] };
type FormState = { objectKey: string; record?: ManagedRecord };

function pageFromParam(value: string | null): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed - 1 : 0;
}

function applicationColumns(object: ApplicationObject): ApplicationField[] {
  return applicationColumnKeys(object)
    .map((key) => object.fields.find((field) => field.key === key)!)
    .filter(Boolean);
}

export function ApplicationManager({ projectId, model, version, role, canManage, initialSummary, initialObjects }: {
  projectId: string;
  model: ApplicationModel | null;
  version: number;
  role: WorkspaceRole;
  canManage: boolean;
  initialSummary: ApplicationSummary;
  initialObjects: ManagedObjectData[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const readableObjects = useMemo(() => model?.objects.filter((object) => roleCan(model, role, object.key, 'read')) ?? [], [model, role]);
  const [activeKey, setActiveKey] = useState(() => {
    const requested = searchParams.get('objet');
    return requested === 'routes' || requested === 'summary' || readableObjects.some((object) => object.key === requested) ? requested! : readableObjects[0]?.key ?? 'routes';
  });
  const selectedKey = activeKey === 'routes' || activeKey === 'summary' || readableObjects.some((object) => object.key === activeKey) ? activeKey : readableObjects[0]?.key ?? 'routes';
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
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<FormState | null>(null);
  const [modelEditorOpen, setModelEditorOpen] = useState(false);
  const routes = useMemo(() => model ? buildApplicationRoutes(model) : [], [model]);
  const activeColumns = useMemo(() => activeObject ? applicationColumns(activeObject) : [], [activeObject]);
  const visibleRecords = useMemo(() => activeObject ? records[activeObject.key] ?? [] : [], [activeObject, records]);
  const baseUrl = `/api/projects/${projectId}/application`;
  const cacheRelationRecord = useCallback((record: ManagedRecord) => {
    setRelationRecords((current) => {
      const existing = current[record.objectKey] ?? [];
      if (existing.some((candidate) => candidate.id === record.id)) return current;
      return { ...current, [record.objectKey]: [record, ...existing].slice(0, RELATION_CACHE_LIMIT) };
    });
  }, []);
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
    const missingByTarget = new Map<string, Set<string>>();
    for (const field of activeColumns) {
      if (field.type !== 'relation') continue;
      const targetKey = field.targetObject!;
      const knownIds = new Set((relationRecords[targetKey] ?? []).map((record) => record.id));
      for (const record of visibleRecords) {
        const relationId = record.data[field.key];
        if (typeof relationId !== 'string' || knownIds.has(relationId)) continue;
        const missing = missingByTarget.get(targetKey) ?? new Set<string>();
        missing.add(relationId);
        missingByTarget.set(targetKey, missing);
      }
    }
    const requests: { targetKey: string; params: URLSearchParams }[] = [];
    for (const [targetKey, identifiers] of missingByTarget) {
      const ids = [...identifiers];
      for (let index = 0; index < ids.length; index += RELATION_OPTION_LIMIT) {
        const params = new URLSearchParams({ limit: String(RELATION_OPTION_LIMIT), offset: '0' });
        for (const id of ids.slice(index, index + RELATION_OPTION_LIMIT)) params.append('id', id);
        requests.push({ targetKey, params });
      }
    }
    if (!requests.length) return;
    const controller = new AbortController();
    void Promise.all(requests.map(async ({ targetKey, params }) => {
      const result = await apiFetch<{ records: ManagedRecord[] }>(`${baseUrl}/objects/${targetKey}?${params}`, { signal: controller.signal });
      return result.records;
    })).then((groups) => {
      if (controller.signal.aborted) return;
      const resolved = groups.flat();
      if (!resolved.length) return;
      setRelationRecords((current) => {
        const next = { ...current };
        for (const record of resolved) {
          const existing = next[record.objectKey] ?? [];
          next[record.objectKey] = [record, ...existing.filter((candidate) => candidate.id !== record.id)].slice(0, RELATION_CACHE_LIMIT);
        }
        return next;
      });
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name !== 'AbortError') setMessage('Les enregistrements sont chargés, mais certains libellés de relation n’ont pas pu être actualisés.');
    });
    return () => controller.abort();
  }, [activeColumns, baseUrl, relationRecords, visibleRecords]);

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
    if (!reloadKey) return;
    const controller = new AbortController();
    void apiFetch<ApplicationSummary>(`${baseUrl}/summary`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setSummary(result); })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') setMessage('Les données sont enregistrées, mais le tableau de bord n’a pas pu être actualisé.');
      });
    return () => controller.abort();
  }, [baseUrl, reloadKey]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('objet', selectedKey);
    if (selectedKey === 'routes' || selectedKey === 'summary') {
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

  if (!model) return <section className="application-empty empty-state">
    <span className="eyebrow">Applications de gestion</span>
    <h2>Choisissez votre activité</h2>
    <p>WOOB exécute des données, des formulaires, des rôles et des processus de gestion sans générer un backend spécifique à chaque projet.</p>
    {canManage ? <>
      <p>Chaque point de départ est un modèle métier déterministe, personnalisable ensuite, et non une réponse présentée comme générée par une IA.</p>
      <div className="application-template-list">{managedApplicationTemplates.map((template) => <article key={template.id}>
        <div><h3>{template.name}</h3><p>{template.description}</p></div>
        <button className="button coral" disabled={pending} onClick={async () => {
          setPending(true); setMessage('');
          try {
            await apiFetch(baseUrl, { method: 'PUT', body: JSON.stringify({ model: template.model, baseVersion: null }) });
            router.refresh();
          } catch (error) { setMessage(errorMessage(error)); setPending(false); }
        }}>{template.actionLabel}</button>
      </article>)}</div>
    </> : <p>Un propriétaire ou un administrateur doit initialiser l’application de gestion.</p>}
    {message && <p className="form-status" role="alert">{message}</p>}
  </section>;

  const can = (objectKey: string, operation: ApplicationOperation) => roleCan(model, role, objectKey, operation);
  const roleLabel = (key: WorkspaceRole) => model.roles.find((item) => item.key === key)?.label ?? key;
  const reload = () => setReloadKey((value) => value + 1);

  async function run(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setPending(true); setMessage('');
    try { await action(); setMessage(success); reload(); return true; }
    catch (error) { setMessage(errorMessage(error)); return false; }
    finally { setPending(false); }
  }

  async function exportActiveObject() {
    if (!activeObject) return;
    setExporting(true); setMessage('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const response = await fetch(`${baseUrl}/objects/${activeObject.key}/export?${params}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(body.error?.message || `Export impossible (${response.status}).`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `woob-${activeObject.key}.csv`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const exported = Number(response.headers.get('X-Export-Row-Count') ?? 0);
      const total = Number(response.headers.get('X-Export-Total-Count') ?? exported);
      const truncated = response.headers.get('X-Export-Truncated') === 'true';
      setMessage(truncated ? `Export CSV limité à ${exported} lignes sur ${total} correspondances.` : `Export CSV : ${exported} ligne${exported === 1 ? '' : 's'}.`);
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setExporting(false); }
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
      <button disabled={modelEditorOpen} className={selectedKey === 'summary' ? 'active' : ''} aria-current={selectedKey === 'summary' ? 'page' : undefined} onClick={() => selectObject('summary')}>Vue d’ensemble<span>{summary.total}</span></button>
      {readableObjects.map((object) => <button key={object.key} disabled={modelEditorOpen} className={selectedKey === object.key ? 'active' : ''} aria-current={selectedKey === object.key ? 'page' : undefined} onClick={() => selectObject(object.key)}>{object.pluralLabel}<span>{totals[object.key] ?? 0}</span></button>)}
      <button disabled={modelEditorOpen} className={selectedKey === 'routes' ? 'active' : ''} aria-current={selectedKey === 'routes' ? 'page' : undefined} onClick={() => selectObject('routes')}>Routes &amp; droits<span>{routes.length}</span></button>
    </nav>
    {canManage && !modelEditorOpen && <div className="application-model-actions"><button className="button secondary small" onClick={() => { setForm(null); setMessage(''); setModelEditorOpen(true); }}>Personnaliser le modèle</button></div>}
    {modelEditorOpen && canManage && <ApplicationModelEditor key={`${projectId}-${version}`} model={model} version={version} baseUrl={baseUrl} onApplied={() => { setModelEditorOpen(false); const url = new URL(window.location.href); url.searchParams.set('objet', selectedKey); router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false }); router.refresh(); }} onCancel={() => setModelEditorOpen(false)} />}
    {message && <p className="form-status" role="status">{message}</p>}

    {!modelEditorOpen && selectedKey === 'summary' && <ApplicationSummaryView model={model} summary={summary} onSelect={selectObject} />}

    {!modelEditorOpen && activeObject && readableObjects.some((object) => object.key === activeObject.key) && <section className="application-object">
      <header className="application-object-header"><div><h2>{activeObject.pluralLabel}</h2><p>{activeObject.description || `Enregistrements gérés par le modèle ${model.name}.`}</p></div><div className="application-object-actions"><button className="button secondary small" disabled={pending || exporting} onClick={() => void exportActiveObject()}>{exporting ? 'Export…' : 'Exporter CSV'}</button>{can(activeObject.key, 'create') && <button className="button dark small" disabled={pending} onClick={() => setForm({ objectKey: activeObject.key })}>Ajouter : {activeObject.label}</button>}</div></header>
      <div className="application-filters">
        <label>Recherche<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder={`Rechercher dans ${activeObject.pluralLabel.toLowerCase()}`} aria-label={`Rechercher dans ${activeObject.pluralLabel}`} /></label>
        {activeObject.statusField && <label>Statut<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} aria-label="Filtrer par statut"><option value="">Tous les statuts</option>{activeObject.fields.find((field) => field.key === activeObject.statusField)?.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
        <span role="status" aria-atomic="true">{loading ? 'Actualisation…' : `${total} résultat${total > 1 ? 's' : ''}`}</span>
        <span className="application-export-note">L’export CSV reprend la recherche et le statut actifs, avec tous les champs et leurs valeurs brutes, dans la limite de 5 000 lignes.</span>
      </div>
      {form?.objectKey === activeObject.key && <ApplicationRecordForm key={`${form.objectKey}-${form.record?.id ?? 'new'}`} object={activeObject} record={form.record} records={relationRecords} model={model} baseUrl={baseUrl} onRelationResolved={cacheRelationRecord} pending={pending} onCancel={() => setForm(null)} onSubmit={async (data) => {
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

    {!modelEditorOpen && selectedKey === 'routes' && <section className="application-routes"><header><div><h2>Plan d’exécution et permissions</h2><p>Chaque opération est déduite du modèle actif, puis contrôlée à nouveau côté serveur.</p></div><span className="status-pill">{routes.length} routes logiques</span></header><div className="application-route-list">{routes.map((route) => <article key={route.id}><span className={`http-method ${route.method.toLowerCase()}`}>{route.method}</span><div><strong>{route.label}</strong><code>{route.id}</code></div><p>{route.roles.length ? route.roles.map(roleLabel).join(', ') : 'Aucun rôle autorisé'}</p></article>)}</div><p className="application-api-note">Les routes techniques restent internes et authentifiées. Aucune API publique, clé d’accès, redirection personnalisée ou publication de ces objets n’est activée dans ce lot.</p></section>}
    {!modelEditorOpen && !readableObjects.length && selectedKey !== 'routes' && selectedKey !== 'summary' && <div className="empty-state"><p>Votre rôle ne possède aucun droit de lecture sur ce modèle.</p></div>}
  </div>;
}

function ApplicationSummaryView({ model, summary, onSelect }: { model: ApplicationModel; summary: ApplicationSummary; onSelect: (objectKey: string) => void }) {
  return <section className="application-summary">
    <header><div><h2>Vue d’ensemble</h2><p>Compteurs calculés sur tous les enregistrements que votre rôle peut lire, au-delà de la pagination.</p></div><span className="status-pill">{summary.total} enregistrement{summary.total === 1 ? '' : 's'}</span></header>
    {summary.objects.length ? <div className="application-summary-grid">{summary.objects.map((objectSummary) => {
      const object = model.objects.find((candidate) => candidate.key === objectSummary.objectKey);
      if (!object) return null;
      const statusField = object.statusField ? object.fields.find((field) => field.key === object.statusField) : undefined;
      return <article className="application-summary-card" key={object.key}>
        <header><div><h3>{object.pluralLabel}</h3><p>{object.description}</p></div><div className="application-summary-total"><strong>{objectSummary.total}</strong><span>enregistrement{objectSummary.total === 1 ? '' : 's'}</span></div></header>
        {statusField?.type === 'enum' ? <ul aria-label={`Statuts : ${object.pluralLabel}`}>{statusField.options?.map((option) => <li key={option.value}><span>{option.label}</span><strong>{objectSummary.statuses.find((status) => status.value === option.value)?.count ?? 0}</strong></li>)}</ul> : <p className="application-summary-empty">Objet sans processus de statut.</p>}
        <button className="button ghost small" onClick={() => onSelect(object.key)}>Consulter : {object.pluralLabel}</button>
      </article>;
    })}</div> : <p className="application-summary-empty">Votre rôle ne possède aucun objet lisible dans ce modèle.</p>}
  </section>;
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
  const columns = applicationColumns(object);
  return <div className="application-table-wrap" aria-busy={loading}><table className="application-table"><caption>{object.pluralLabel} gérés par le modèle</caption><thead><tr>{columns.map((field) => <th key={field.key} scope="col">{field.label}</th>)}<th scope="col">Actions</th></tr></thead><tbody>{records.map((record) => {
    const status = object.statusField ? record.data[object.statusField] : undefined;
    const actions = object.actions.filter((action) => typeof status === 'string' && action.from.includes(status) && roleCanAction(model, role, object.key, action.key));
    const title = displayValue(object, titleField, record);
    return <tr key={record.id}>{columns.map((field) => <td key={field.key} data-label={field.label}>{field.key === object.statusField ? <span className="application-status">{displayValue(object, field, record)}</span> : displayValue(object, field, record)}</td>)}<td className="application-row-actions" data-label="Actions">{actions.map((action) => <button key={action.key} className="button secondary small" disabled={pending} aria-label={`${action.label} : ${title}`} onClick={() => void onAction(record, action.key, action.label)}>{action.label}</button>)}{roleCan(model, role, object.key, 'update') && <button className="button ghost small" disabled={pending} aria-label={`Modifier : ${title}`} onClick={() => onEdit(record)}>Modifier</button>}{roleCan(model, role, object.key, 'delete') && <button className="button ghost small danger" disabled={pending} aria-label={`Supprimer : ${title}`} onClick={() => void onDelete(record)}>Supprimer</button>}{!actions.length && !roleCan(model, role, object.key, 'update') && !roleCan(model, role, object.key, 'delete') && <span>Lecture seule</span>}</td></tr>;
  })}{!records.length && <tr className="application-empty-row"><td colSpan={columns.length + 1}><div className="application-no-results">{loading ? 'Chargement des enregistrements…' : 'Aucun enregistrement ne correspond à ces critères.'}</div></td></tr>}</tbody></table></div>;
}

function ApplicationRecordForm({ object, model, record, records, baseUrl, onRelationResolved, pending, onCancel, onSubmit }: {
  object: ApplicationObject;
  model: ApplicationModel;
  record?: ManagedRecord | undefined;
  records: Record<string, ManagedRecord[]>;
  baseUrl: string;
  onRelationResolved: (record: ManagedRecord) => void;
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
  return <form className="application-record-form" onSubmit={submit}><header><h3>{record ? `Modifier : ${object.label}` : `Ajouter : ${object.label}`}</h3><button type="button" className="button ghost small" onClick={onCancel}>Fermer</button></header><div className="application-form-grid">{object.fields.filter((field) => field.key !== object.statusField).map((field) => <ApplicationFieldInput key={field.key} field={field} object={object} model={model} record={record} records={records} baseUrl={baseUrl} onRelationResolved={onRelationResolved} />)}</div>{object.statusField && <p className="field-hint">Le statut initial et ses changements sont contrôlés par les actions du processus, jamais par ce formulaire.</p>}<div className="button-row"><button className="button coral small" disabled={pending}>{record ? 'Enregistrer les modifications' : 'Créer l’enregistrement'}</button><button type="button" className="button secondary small" onClick={onCancel}>Annuler</button></div></form>;
}

function ApplicationFieldInput({ field, object, model, record, records, baseUrl, onRelationResolved }: {
  field: ApplicationField;
  object: ApplicationObject;
  model: ApplicationModel;
  record?: ManagedRecord | undefined;
  records: Record<string, ManagedRecord[]>;
  baseUrl: string;
  onRelationResolved: (record: ManagedRecord) => void;
}) {
  const id = `application-${object.key}-${field.key}`;
  // Defaults initialize new records only; editing must not backfill fields absent from older records.
  const value = record ? record.data[field.key] : field.defaultValue;
  const common = { id, name: field.key, required: field.required, 'aria-describedby': field.help ? `${id}-help` : undefined };
  const label = <>{field.label}{field.required && <span aria-hidden="true"> *</span>}</>;
  const help = field.help && <small id={`${id}-help`}>{field.help}</small>;
  if (field.type === 'boolean') return <label className="application-checkbox" htmlFor={id}>{label}<input {...common} type="checkbox" defaultChecked={value === true} />{help}</label>;
  if (field.type === 'textarea') return <label htmlFor={id}>{label}<textarea {...common} rows={4} maxLength={field.maxLength ?? 10_000} defaultValue={typeof value === 'string' ? value : ''} />{help}</label>;
  if (field.type === 'enum') return <label htmlFor={id}>{label}<select {...common} defaultValue={typeof value === 'string' ? value : ''}>{!field.required && <option value="">Non renseigné</option>}{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{help}</label>;
  if (field.type === 'relation') return <ApplicationRelationInput id={id} field={field} model={model} value={typeof value === 'string' ? value : ''} records={records} baseUrl={baseUrl} onRelationResolved={onRelationResolved} />;
  const type = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'integer' || field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
  return <label htmlFor={id}>{label}<input {...common} type={type} maxLength={['text', 'email', 'phone'].includes(field.type) ? field.maxLength : undefined} min={field.min} max={field.max} step={field.type === 'number' ? 'any' : undefined} defaultValue={typeof value === 'string' || typeof value === 'number' ? value : ''} />{help}</label>;
}

function ApplicationRelationInput({ id, field, model, value, records, baseUrl, onRelationResolved }: {
  id: string;
  field: ApplicationField;
  model: ApplicationModel;
  value: string;
  records: Record<string, ManagedRecord[]>;
  baseUrl: string;
  onRelationResolved: (record: ManagedRecord) => void;
}) {
  const targetKey = field.targetObject!;
  const targetObject = model.objects.find((candidate) => candidate.key === targetKey);
  const initialOptions = records[targetKey] ?? [];
  const [selectedId, setSelectedId] = useState(value);
  const [selectedRecord, setSelectedRecord] = useState<ManagedRecord | undefined>(() => initialOptions.find((option) => option.id === value));
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ query: string; records: ManagedRecord[] } | null>(null);
  const [error, setError] = useState('');
  const normalizedQuery = query.trim();
  const cachedSelection = initialOptions.find((option) => option.id === selectedId);
  const effectiveSelection = selectedRecord?.id === selectedId ? selectedRecord : cachedSelection;
  const currentSearchResult = normalizedQuery && searchResult?.query === normalizedQuery ? searchResult : null;
  const resultOptions = normalizedQuery ? currentSearchResult?.records ?? [] : initialOptions;
  const options = effectiveSelection && !resultOptions.some((option) => option.id === effectiveSelection.id) ? [effectiveSelection, ...resultOptions] : resultOptions;
  const searching = Boolean(normalizedQuery && !currentSearchResult && !error);
  const statusId = `${id}-relation-status`;
  const targetTitle = (option: ManagedRecord) => String(option.data[targetObject?.titleField ?? ''] ?? option.id);

  useEffect(() => {
    if (!selectedId || effectiveSelection) return;
    const controller = new AbortController();
    void apiFetch<{ record: ManagedRecord }>(`${baseUrl}/objects/${targetKey}/${selectedId}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setSelectedRecord(result.record);
        setError('');
        onRelationResolved(result.record);
      })
      .catch((reason: unknown) => { if (reason instanceof Error && reason.name !== 'AbortError') setError(errorMessage(reason)); });
    return () => controller.abort();
  }, [baseUrl, effectiveSelection, onRelationResolved, selectedId, targetKey]);

  useEffect(() => {
    if (!normalizedQuery) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: String(RELATION_SEARCH_LIMIT), offset: '0', q: normalizedQuery });
      void apiFetch<{ records: ManagedRecord[] }>(`${baseUrl}/objects/${targetKey}?${params}`, { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          setSearchResult({ query: normalizedQuery, records: result.records });
          setError('');
        })
        .catch((reason: unknown) => { if (reason instanceof Error && reason.name !== 'AbortError') setError(errorMessage(reason)); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [baseUrl, normalizedQuery, targetKey]);

  const status = normalizedQuery
    ? currentSearchResult
      ? `${currentSearchResult.records.length} relation${currentSearchResult.records.length > 1 ? 's' : ''} trouvée${currentSearchResult.records.length > 1 ? 's' : ''}.`
      : 'Recherche des relations…'
    : initialOptions.length >= RELATION_OPTION_LIMIT
      ? `${RELATION_OPTION_LIMIT} premières options chargées. Recherchez pour accéder aux autres enregistrements.`
      : initialOptions.length
        ? 'Vous pouvez rechercher pour affiner les options.'
        : 'Aucune option chargée. Vous pouvez lancer une recherche.';

  return <div className="application-relation-field" aria-busy={searching}>
    <label htmlFor={id}>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>
    <input
      type="search"
      value={query}
      maxLength={120}
      placeholder={`Rechercher dans ${targetObject?.pluralLabel ?? targetKey}`}
      aria-label={`Rechercher : ${targetObject?.pluralLabel ?? targetKey}`}
      aria-describedby={statusId}
      onChange={(event) => { setQuery(event.target.value); setError(''); }}
    />
    <select
      id={id}
      name={field.key}
      required={field.required}
      value={selectedId}
      aria-describedby={`${field.help ? `${id}-help ` : ''}${statusId}`}
      onChange={(event) => {
        const nextId = event.target.value;
        const nextRecord = options.find((option) => option.id === nextId);
        setSelectedId(nextId);
        setSelectedRecord(nextRecord);
        setError('');
        if (nextRecord) onRelationResolved(nextRecord);
      }}
    >
      <option value="" disabled={field.required}>Sélectionner : {targetObject?.label ?? targetKey}</option>
      {selectedId && !effectiveSelection && <option value={selectedId}>Référence liée</option>}
      {options.map((option) => <option key={option.id} value={option.id}>{targetTitle(option)}</option>)}
    </select>
    {field.help && <small id={`${id}-help`}>{field.help}</small>}
    <small id={statusId} className="application-relation-status" role={error ? 'alert' : 'status'} aria-atomic="true">{error || status}</small>
  </div>;
}
