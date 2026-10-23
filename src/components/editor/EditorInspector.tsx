'use client';

import { useState } from 'react';
import { componentRegistry, type FieldDefinition } from '@/lib/document/registry';
import type { EditorMode, PageNode, StyleProperty, StyleState, ThemeSettings, Viewport } from '@/lib/document/types';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { AssetLibrary } from './AssetLibrary';
import { DesignSystemInspector } from './DesignSystemInspector';
import { StyleInspector, type StyleActions } from './StyleInspector';

type Props = {
  node: PageNode | undefined;
  viewport: Viewport;
  mode: EditorMode;
  projectId: string;
  theme: ThemeSettings;
  showTheme: boolean;
  onPropChange: (key: string, value: unknown) => void;
  onStyleChange: (property: StyleProperty, value: string | number | null, state?: StyleState) => void;
  onThemeChange: (theme: ThemeSettings) => void;
  styleActions: Omit<StyleActions, 'onChange'>;
};

function FieldControl({ field, value, onChange, projectId, idPrefix }: { field: FieldDefinition; value: unknown; onChange: (value: unknown) => void; projectId: string; idPrefix?: string }) {
  const [uploading, setUploading] = useState(false); const [error, setError] = useState(''); const [libraryOpen, setLibraryOpen] = useState(false);
  const common = { id: `${idPrefix ? `${idPrefix}-` : 'field-'}${field.key}`, 'data-testid': `field-${field.key}` };
  if (field.kind === 'boolean') return <label className="switch-field" htmlFor={common.id}><span>{field.label}</span><input {...common} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /></label>;
  if (field.kind === 'select') return <label htmlFor={common.id}>{field.label}<select {...common} value={String(value ?? field.options?.[0]?.value ?? '')} onChange={(event) => onChange(field.key === 'level' ? Number(event.target.value) : event.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  if (field.kind === 'number') return <label htmlFor={common.id}>{field.label}<input {...common} type="number" value={Number(value ?? 0)} onChange={(event) => onChange(Number(event.target.value))} /></label>;
  if (field.kind === 'textarea') return <label htmlFor={common.id}>{field.label}<textarea {...common} rows={4} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></label>;
  if (field.kind === 'asset') {
    async function upload(file?: File) {
      if (!file) return; setUploading(true); setError('');
      try { const body = new FormData(); body.set('file', file); body.set('alt', file.name.replace(/\.[^.]+$/, '')); const result = await apiFetch<{ asset: { id: string } }>(`/api/projects/${projectId}/assets`, { method: 'POST', body }); onChange(result.asset.id); }
      catch (reason) { setError(errorMessage(reason)); } finally { setUploading(false); }
    }
    return <div className="asset-control"><label htmlFor={common.id}>{field.label}</label><div className="asset-input-row"><input {...common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder="Aucun média" /><label className="upload-button">{uploading ? '…' : '↑'}<input type="file" aria-label={`Téléverser : ${field.label}`} accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => upload(event.target.files?.[0])} disabled={uploading} /></label></div><button type="button" className="asset-library-open" onClick={() => setLibraryOpen(true)}>Bibliothèque de médias</button>{error && <small className="field-error" role="alert">{error}</small>}{libraryOpen && <AssetLibrary projectId={projectId} onClose={() => setLibraryOpen(false)} onSelect={(assetId) => { onChange(assetId); setLibraryOpen(false); }} />}</div>;
  }
  return <label htmlFor={common.id}>{field.label}<input {...common} type="text" inputMode={field.kind === 'url' ? 'url' : undefined} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function EditorInspector({ node, viewport, mode, projectId, theme, showTheme, onPropChange, onStyleChange, onThemeChange, styleActions }: Props) {
  if (showTheme) return <DesignSystemInspector theme={theme} mode={mode} onChange={onThemeChange} />;
  if (!node || node.type === 'page') return <div className="inspector-empty"><span>⌁</span><h2>Sélectionnez un bloc</h2><p>Choisissez un élément du canevas ou de la structure pour modifier son contenu et son apparence.</p></div>;
  const definition = componentRegistry[node.type];
  return <div className="inspector-content"><div className="inspector-title"><span>{definition.category}</span><h2>{definition.label}</h2><p>{definition.description}</p></div>
    <section className="inspector-section"><h3>Contenu</h3>{definition.fields.map((field) => <FieldControl key={field.key} field={field} value={node.props[field.key]} onChange={(value) => onPropChange(field.key, value)} projectId={projectId} />)}{typeof node.props.src === 'string' && <label>URL d’image externe<input value={node.props.src} onChange={(event) => onPropChange('src', event.target.value)} placeholder="https://…" /></label>}{typeof node.props.imageUrl === 'string' && <label>URL d’image externe<input value={node.props.imageUrl} onChange={(event) => onPropChange('imageUrl', event.target.value)} placeholder="https://…" /></label>}</section>
    {definition.collectionFields && Object.entries(definition.collectionFields).map(([collectionKey, fields]) => {
      const items = Array.isArray(node.props[collectionKey]) ? node.props[collectionKey] as Record<string, unknown>[] : [];
      return <section className="inspector-section collection-editor" key={collectionKey}><h3>Éléments <span>{items.length}</span></h3>{items.map((item, index) => <article key={index}><header><strong>Élément {index + 1}</strong><button onClick={() => onPropChange(collectionKey, items.filter((_, i) => i !== index))} aria-label={`Supprimer l’élément ${index + 1}`}>×</button></header>{fields.map((field) => <FieldControl key={field.key} idPrefix={`collection-${collectionKey}-${index}`} field={field} value={item[field.key]} onChange={(value) => onPropChange(collectionKey, items.map((entry, i) => i === index ? { ...entry, [field.key]: value } : entry))} projectId={projectId} />)}{Object.entries(item).filter(([, value]) => Array.isArray(value) && value.every((entry) => typeof entry === 'string')).map(([key, value]) => <label key={key}>{key}<textarea rows={3} value={(value as string[]).join('\n')} onChange={(event) => onPropChange(collectionKey, items.map((entry, i) => i === index ? { ...entry, [key]: event.target.value.split('\n') } : entry))} /></label>)}</article>)}<button className="add-collection-item" onClick={() => { const item = Object.fromEntries(fields.map((field) => [field.key, field.kind === 'boolean' ? false : field.kind === 'number' ? 1 : ''])); if (collectionKey === 'items' && node.type === 'pricing') Object.assign(item, { features: [], period: '', highlighted: false }); onPropChange(collectionKey, [...items, item]); }}>＋ Ajouter un élément</button></section>;
    })}
    <StyleInspector node={node} viewport={viewport} mode={mode} theme={theme} actions={{ ...styleActions, onChange: onStyleChange }} />
  </div>;
}
