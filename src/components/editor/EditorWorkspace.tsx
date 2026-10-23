'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Project, Page } from '@/server/db/schema';
import type { ComponentType, EditorMode, PageDocument, PageNode, SiteSnapshot, ThemeSettings, Viewport } from '@/lib/document/types';
import { componentRegistry, createNode, insertableComponents } from '@/lib/document/registry';
import { cloneDocument, findNode, validatePageDocument } from '@/lib/document/validation';
import { createId } from '@/lib/id';
import { DocumentRenderer } from '@/components/renderer/DocumentRenderer';
import { Logo } from '@/components/ui/Logo';
import { EditorInspector } from './EditorInspector';
import { AiPanel } from './AiPanel';
import { VersionHistory } from './VersionHistory';
import { insertNode, moveNode, moveNodeBy, removeNode } from '@/lib/document/operations';
import { apiFetch, ClientApiError, errorMessage } from '@/lib/client-api';

type PageSummary = { id: string; name: string; path: string; kind: string; draftRevision: number };
type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export function EditorWorkspace({ project, pages, initialPage, initialSite }: { project: Project; pages: PageSummary[]; initialPage: Page; initialSite: SiteSnapshot }) {
  const router = useRouter();
  const [document, setDocumentState] = useState<PageDocument>(() => cloneDocument(initialPage.draftDocument));
  const documentRef = useRef(document);
  const revisionRef = useRef(initialPage.draftRevision);
  const editVersionRef = useRef(0);
  const savingRef = useRef(false);
  const [selectedId, setSelectedId] = useState(() => document.root.children?.find((node) => node.type === 'heading')?.id || document.root.children?.[0]?.id || document.root.id);
  const [history, setHistory] = useState<PageDocument[]>([]);
  const [future, setFuture] = useState<PageDocument[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveMessage, setSaveMessage] = useState('Toutes les modifications sont enregistrées');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [leftTab, setLeftTab] = useState<'components' | 'structure' | 'pages'>('components');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<EditorMode>('advanced');
  const [showTheme, setShowTheme] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'left' | 'right' | null>(null);
  const [notice, setNotice] = useState('');
  const [pendingAction, setPendingAction] = useState(false);

  const selectedNode = findNode(document.root, selectedId);
  const editorSite = useMemo<SiteSnapshot>(() => ({ ...initialSite, theme: document.theme, pages: initialSite.pages.map((page) => page.id === initialPage.id ? { ...page, document } : page) }), [initialSite, initialPage.id, document]);

  const setDocument = useCallback((next: PageDocument, dirty = true) => {
    documentRef.current = next;
    setDocumentState(next);
    if (dirty) { editVersionRef.current += 1; setSaveState('dirty'); setSaveMessage('Modifications non enregistrées'); }
  }, []);

  const commit = useCallback((mutate: (draft: PageDocument) => void, selectId?: string) => {
    if (saveState === 'conflict') return;
    const current = documentRef.current;
    const next = cloneDocument(current);
    mutate(next);
    const validation = validatePageDocument(next);
    if (!validation.success) { setNotice(validation.issues[0]?.message || 'Modification invalide.'); return; }
    setHistory((items) => [...items.slice(-59), current]);
    setFuture([]);
    setDocument(validation.data);
    if (selectId) { setSelectedId(selectId); setShowTheme(false); }
  }, [saveState, setDocument]);

  const updateSelected = useCallback((updater: (node: PageNode) => void) => {
    commit((draft) => { const node = findNode(draft.root, selectedId); if (node) updater(node); });
  }, [commit, selectedId]);

  const undo = useCallback(() => {
    if (!history.length || savingRef.current) return;
    const previous = history[history.length - 1]!;
    const current = documentRef.current;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [current, ...items].slice(0, 60));
    setDocument(previous);
  }, [history, setDocument]);

  const redo = useCallback(() => {
    if (!future.length || savingRef.current) return;
    const next = future[0]!;
    const current = documentRef.current;
    setFuture((items) => items.slice(1));
    setHistory((items) => [...items, current]);
    setDocument(next);
  }, [future, setDocument]);

  const save = useCallback(async (): Promise<boolean> => {
    if (savingRef.current || saveState === 'conflict') return false;
    const snapshot = cloneDocument(documentRef.current);
    const editVersion = editVersionRef.current;
    savingRef.current = true; setSaveState('saving'); setSaveMessage('Enregistrement…');
    try {
      const result = await apiFetch<{ page: Page }>(`/api/pages/${initialPage.id}/document`, { method: 'PUT', body: JSON.stringify({ baseRevision: revisionRef.current, document: snapshot }) });
      revisionRef.current = result.page.draftRevision;
      const current = cloneDocument(documentRef.current);
      current.revision = result.page.draftRevision;
      documentRef.current = current; setDocumentState(current);
      if (editVersionRef.current === editVersion) { setSaveState('saved'); setSaveMessage('Toutes les modifications sont enregistrées'); }
      else { setSaveState('dirty'); setSaveMessage('De nouvelles modifications sont à enregistrer'); }
      return true;
    } catch (error) {
      if (error instanceof ClientApiError && error.status === 409) { setSaveState('conflict'); setSaveMessage('Conflit : une version plus récente existe. Rechargez avant de continuer.'); }
      else { setSaveState('error'); setSaveMessage(errorMessage(error)); }
      return false;
    } finally { savingRef.current = false; }
  }, [initialPage.id, saveState]);

  useEffect(() => {
    if (!['dirty', 'error'].includes(saveState)) return;
    const timer = window.setTimeout(() => { void save(); }, 1400);
    return () => window.clearTimeout(timer);
  }, [document, saveState, save]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (['dirty', 'error', 'saving'].includes(saveState)) { event.preventDefault(); event.returnValue = ''; } };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobilePanel(null); setShowVersions(false); setShowAi(false); return; }
      const target = event.target as HTMLElement | null;
      const editing = target?.matches('input, textarea, select, [contenteditable="true"]');
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); return; }
      if (editing) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId !== documentRef.current.root.id) { event.preventDefault(); commit((draft) => { removeNode(draft.root, selectedId); }); setSelectedId(documentRef.current.root.id); }
    };
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('keydown', keyboard); };
  }, [save, saveState, undo, redo, selectedId, commit]);

  function addComponent(type: Exclude<ComponentType, 'page'>) {
    const node = createNode(type, createId('node'));
    commit((draft) => {
      const selected = findNode(draft.root, selectedId);
      const inserted = selected && ['section', 'page'].includes(selected.type) ? insertNode(draft.root, node, selected.id, 'inside') : insertNode(draft.root, node, selectedId, 'after') || insertNode(draft.root, node, draft.root.id, 'inside');
      if (!inserted) throw new Error('Insertion impossible');
    }, node.id);
    setMobilePanel('right');
  }

  async function publish() {
    if (saveState !== 'saved') {
      const saved = await save();
      if (!saved) { setNotice('Publication interrompue : le brouillon n’a pas pu être enregistré.'); return; }
    }
    setPendingAction(true); setNotice('');
    try { const result = await apiFetch<{ url: string }>(`/api/projects/${project.id}/publish`, { method: 'POST' }); setNotice(`Site publié : ${result.url}`); router.refresh(); }
    catch (error) { setNotice(errorMessage(error)); } finally { setPendingAction(false); }
  }

  async function checkpoint() {
    if (saveState !== 'saved') {
      const saved = await save();
      if (!saved) { setNotice('Point de restauration non créé : la sauvegarde a échoué.'); return; }
    }
    setPendingAction(true); try { await apiFetch(`/api/pages/${initialPage.id}/checkpoint`, { method: 'POST' }); setNotice('Point de restauration enregistré.'); } catch (error) { setNotice(errorMessage(error)); } finally { setPendingAction(false); }
  }

  async function restoreVersion(versionId: string): Promise<boolean> {
    if (savingRef.current || saveState === 'conflict') { setNotice('Attendez la sauvegarde ou résolvez le conflit avant de restaurer.'); return false; }
    const discard = saveState !== 'saved';
    if (discard && !window.confirm('Restaurer cette version remplacera les modifications non enregistrées du canevas. Continuer ?')) return false;
    setPendingAction(true); setSaveState('saving'); setSaveMessage('Restauration…');
    try {
      const result = await apiFetch<{ page: Page; restoredFrom: number }>(`/api/pages/${initialPage.id}/versions/${versionId}/restore`, { method: 'POST', body: JSON.stringify({ baseRevision: revisionRef.current }) });
      const next = cloneDocument(result.page.draftDocument);
      next.revision = result.page.draftRevision;
      revisionRef.current = result.page.draftRevision;
      editVersionRef.current += 1;
      documentRef.current = next; setDocumentState(next);
      setHistory([]); setFuture([]); setSaveState('saved'); setSaveMessage(`Version ${result.restoredFrom} restaurée et enregistrée`);
      setShowVersions(false); setNotice(`Version ${result.restoredFrom} restaurée dans une nouvelle révision.`);
      return true;
    } catch (error) {
      setSaveState(discard ? 'dirty' : 'saved'); setSaveMessage(discard ? 'Modifications non enregistrées' : 'Restauration impossible');
      setNotice(errorMessage(error)); throw error;
    } finally { setPendingAction(false); }
  }

  const filteredComponents = insertableComponents.filter((item) => `${item.label} ${item.description} ${item.keywords.join(' ')}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="editor-shell"><header className="editor-topbar"><div className="editor-top-left"><Logo href={`/dashboard/projects/${project.id}`} compact /><Link className="editor-back" href={`/dashboard/projects/${project.id}`} aria-label="Retour au projet">←</Link><span className="editor-divider" /><select className="editor-page-select" value={initialPage.id} onChange={(event) => { if (!['saved'].includes(saveState) && !window.confirm('Quitter sans attendre la sauvegarde ?')) return; router.push(`/dashboard/projects/${project.id}/editor/${event.target.value}`); }} aria-label="Page en cours">{pages.map((page) => <option key={page.id} value={page.id}>{page.name} · {page.path}</option>)}</select><span className={`save-indicator ${saveState}`} role="status">{saveState === 'saving' ? '↻' : saveState === 'saved' ? '✓' : saveState === 'dirty' ? '●' : '!'}</span><span className="save-message">{saveMessage}</span></div><div className="editor-top-actions"><div className="history-buttons"><button onClick={undo} disabled={!history.length || saveState === 'saving'} title="Annuler (Ctrl+Z)">↶</button><button onClick={redo} disabled={!future.length || saveState === 'saving'} title="Rétablir (Ctrl+Shift+Z)">↷</button></div><select className="mode-select" value={mode} onChange={(event) => setMode(event.target.value as EditorMode)} aria-label="Mode éditeur"><option value="simple">Simple</option><option value="advanced">Avancé</option></select><button className="button ghost small" onClick={() => { setMobilePanel(null); setShowAi(true); }}>✦ IA</button><a className="button ghost small" href={`/preview/${project.id}${initialPage.path === '/' ? '' : initialPage.path}`} target="_blank">Aperçu ↗</a><button className="button secondary small" data-testid="save-page" onClick={() => void save()} disabled={saveState === 'saving' || saveState === 'conflict'}>Enregistrer</button><button className="button coral small" onClick={() => void publish()} disabled={pendingAction || saveState === 'conflict'}>{pendingAction ? 'Publication…' : 'Publier'}</button></div></header>{mobilePanel && <button type="button" className="editor-panel-backdrop" onClick={() => setMobilePanel(null)} aria-label="Fermer les panneaux" />}<div className="editor-workspace"><aside className={`editor-left ${mobilePanel === 'left' ? 'mobile-open' : ''}`}><div className="editor-left-tabs"><button className={leftTab === 'components' ? 'active' : ''} onClick={() => { setLeftTab('components'); setMobilePanel('left'); }}>＋<span>Ajouter</span></button><button className={leftTab === 'structure' ? 'active' : ''} onClick={() => { setLeftTab('structure'); setMobilePanel('left'); }}>≡<span>Structure</span></button><button className={leftTab === 'pages' ? 'active' : ''} onClick={() => { setLeftTab('pages'); setMobilePanel('left'); }}>▤<span>Pages</span></button></div><div className="editor-left-content">{leftTab === 'components' && <><div className="panel-heading"><h2>Composants</h2><p>Ajoutez un bloc à votre page.</p></div><label className="editor-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un bloc" aria-label="Rechercher un composant" /></label><div className="component-library">{filteredComponents.map((item) => <button key={item.type} onClick={() => addComponent(item.type)}><span className="component-icon">{item.type === 'heading' ? 'H1' : item.type === 'text' ? '¶' : item.type === 'image' ? '▧' : item.type === 'button' ? '↗' : item.type === 'section' ? '▤' : '✦'}</span><div><strong>{item.label}</strong><small>{item.description}</small></div><i>＋</i></button>)}</div></>}{leftTab === 'structure' && <><div className="panel-heading"><h2>Structure</h2><p>Glissez un bloc ou utilisez les flèches.</p></div><StructureTree node={document.root} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setShowTheme(false); setMobilePanel('right'); }} onMove={(id, direction) => commit((draft) => { moveNodeBy(draft.root, id, direction); })} onDrop={(source, target) => commit((draft) => { moveNode(draft.root, source, target, 'before'); })} /></>}{leftTab === 'pages' && <PagesPanel projectId={project.id} pages={pages} currentPage={initialPage} saveState={saveState} />}</div><button type="button" className="panel-close" onClick={() => setMobilePanel(null)} aria-label="Fermer le panneau de blocs">×</button></aside><main className="editor-center"><div className="canvas-toolbar"><div className="mobile-panel-buttons"><button type="button" onClick={() => setMobilePanel('left')}>☰ Blocs</button><button type="button" onClick={() => setMobilePanel('right')}>Propriétés</button></div><div className="viewport-buttons">{(['desktop', 'tablet', 'mobile'] as Viewport[]).map((item) => <button key={item} className={viewport === item ? 'active' : ''} onClick={() => setViewport(item)} title={item === 'desktop' ? 'Ordinateur' : item === 'tablet' ? 'Tablette' : 'Mobile'}>{item === 'desktop' ? '▭' : item === 'tablet' ? '▯' : '▥'}</button>)}</div><span>{viewport === 'desktop' ? '1180 px' : viewport === 'tablet' ? '768 px' : '390 px'}</span><div><button onClick={checkpoint} disabled={pendingAction}>Point de restauration</button><button onClick={() => { setMobilePanel(null); setShowVersions(true); }} disabled={pendingAction}>Historique</button><button className={showTheme ? 'active' : ''} onClick={() => { setShowTheme(!showTheme); setMobilePanel('right'); }}>◐ Thème</button></div></div><div className={`editor-canvas viewport-${viewport}`} data-testid="editor-canvas"><div className="canvas-document" style={{ '--site-primary': document.theme.primaryColor, '--site-secondary': document.theme.secondaryColor, '--site-accent': document.theme.accentColor, '--site-bg': document.theme.backgroundColor, '--site-surface': document.theme.surfaceColor, '--site-text': document.theme.textColor, '--site-muted': document.theme.mutedTextColor, '--site-font': document.theme.fontFamily, '--site-heading-font': document.theme.headingFontFamily, '--site-radius': `${document.theme.radius}px`, '--site-container': `${document.theme.containerWidth}px`, '--site-section-spacing': `${document.theme.sectionSpacing}px` } as React.CSSProperties}><DocumentRenderer document={document} context={{ mode: 'editor', site: editorSite, projectId: project.id, slug: project.slug, selectedNodeId: selectedId, onSelect: (id) => { setSelectedId(id); setShowTheme(false); setMobilePanel('right'); }, viewport }} /></div></div><footer className="editor-statusbar"><span>{document.root.children?.length || 0} blocs · Schéma {document.schemaVersion} · Révision {revisionRef.current}</span><span>Ctrl+S pour enregistrer · Ctrl+Z pour annuler</span></footer></main><aside className={`editor-right ${mobilePanel === 'right' ? 'mobile-open' : ''}`}><EditorInspector node={selectedNode} viewport={viewport} mode={mode} projectId={project.id} theme={document.theme} showTheme={showTheme} onPropChange={(key, value) => updateSelected((node) => { node.props[key] = value; })} onStyleChange={(key, value) => updateSelected((node) => { if (viewport === 'desktop') node.styles[key as keyof typeof node.styles] = value; else { node.responsive ??= {}; const styles = node.responsive[viewport] ??= {}; styles[key as keyof typeof styles] = value; } })} onThemeChange={(key: keyof ThemeSettings, value: string | number) => commit((draft) => { (draft.theme[key] as string | number) = value; })} /><button type="button" className="panel-close" onClick={() => setMobilePanel(null)} aria-label="Fermer le panneau de propriétés">×</button></aside></div>{showVersions && <VersionHistory pageId={initialPage.id} onRestore={restoreVersion} onClose={() => setShowVersions(false)} />}{showAi && <AiPanel pageId={initialPage.id} document={document} site={editorSite} selectedNodeId={selectedId} onClose={() => setShowAi(false)} onApply={(generated) => { commit((draft) => { draft.root = generated.root; draft.theme = generated.theme; }); setShowAi(false); setNotice('Proposition appliquée au brouillon. Vérifiez et enregistrez.'); }} />}{notice && <div className="editor-toast" role="status"><span>{notice}</span>{notice.startsWith('Site publié') && <a href={`/s/${project.slug}`} target="_blank">Voir le site ↗</a>}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}{saveState === 'conflict' && <div className="conflict-banner"><strong>Modification concurrente détectée.</strong><span>Votre texte reste dans cet onglet. Rechargez pour repartir de la dernière version serveur.</span><button onClick={() => window.location.reload()}>Recharger</button></div>}</div>;
}

function StructureTree({ node, selectedId, onSelect, onMove, onDrop, depth = 0 }: { node: PageNode; selectedId: string; onSelect: (id: string) => void; onMove: (id: string, direction: -1 | 1) => void; onDrop: (source: string, target: string) => void; depth?: number }) {
  return <div className="structure-node">{node.id !== node.id ? null : <div className={`structure-row ${selectedId === node.id ? 'selected' : ''}`} style={{ paddingLeft: 8 + depth * 13 }} draggable={node.type !== 'page'} onDragStart={(event) => event.dataTransfer.setData('text/woob-node', node.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/woob-node'); if (source) onDrop(source, node.id); }}><button className="structure-select" onClick={() => onSelect(node.id)}><span>{node.type === 'page' ? '▤' : node.type === 'heading' ? 'H' : '·'}</span>{node.name || (node.type === 'page' ? 'Page' : componentRegistry[node.type].label)}</button>{node.type !== 'page' && <div className="structure-move"><button onClick={() => onMove(node.id, -1)} aria-label="Monter">↑</button><button onClick={() => onMove(node.id, 1)} aria-label="Descendre">↓</button></div>}</div>}{node.children?.map((child) => <StructureTree key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} onMove={onMove} onDrop={onDrop} depth={depth + 1} />)}</div>;
}

function PagesPanel({ projectId, pages, currentPage, saveState }: { projectId: string; pages: PageSummary[]; currentPage: Page; saveState: SaveState }) {
  const [adding, setAdding] = useState(false); const [error, setError] = useState(''); const router = useRouter();
  async function action(pageId: string, actionName: 'duplicate' | 'home') { setError(''); try { await apiFetch(`/api/pages/${pageId}/${actionName}`, { method: 'POST' }); window.location.reload(); } catch (reason) { setError(errorMessage(reason)); } }
  async function remove(pageId: string) { if (!window.confirm('Supprimer cette page du brouillon ?')) return; try { await apiFetch(`/api/pages/${pageId}`, { method: 'DELETE' }); if (pageId === currentPage.id) router.push(`/dashboard/projects/${projectId}`); else window.location.reload(); } catch (reason) { setError(errorMessage(reason)); } }
  async function create(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); try { const result = await apiFetch<{ page: { id: string } }>(`/api/projects/${projectId}/pages`, { method: 'POST', body: JSON.stringify({ name: values.get('name'), path: values.get('path') }) }); router.push(`/dashboard/projects/${projectId}/editor/${result.page.id}`); } catch (reason) { setError(errorMessage(reason)); } }
  async function metadata(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (saveState !== 'saved') { setError('Attendez la sauvegarde du document avant de modifier ses métadonnées.'); return; } const values = new FormData(event.currentTarget); try { await apiFetch(`/api/pages/${currentPage.id}`, { method: 'PATCH', body: JSON.stringify({ name: values.get('name'), path: values.get('path'), seoTitle: values.get('seoTitle'), seoDescription: values.get('seoDescription'), baseRevision: currentPage.draftRevision }) }); window.location.reload(); } catch (reason) { setError(errorMessage(reason)); } }
  return <><div className="panel-heading"><h2>Pages</h2><p>Navigation, accueil et référencement.</p></div><div className="editor-page-list">{pages.map((page) => <article key={page.id} className={page.id === currentPage.id ? 'active' : ''}><a href={`/dashboard/projects/${projectId}/editor/${page.id}`}><strong>{page.name}</strong><code>{page.path}</code></a><div><button onClick={() => action(page.id, 'home')} disabled={page.path === '/'} title="Définir comme accueil">⌂</button><button onClick={() => action(page.id, 'duplicate')} title="Dupliquer">⧉</button><button onClick={() => remove(page.id)} disabled={page.path === '/'} title="Supprimer">×</button></div></article>)}</div><button className="add-collection-item" onClick={() => setAdding(!adding)}>＋ Nouvelle page</button>{adding && <form className="page-create-form" onSubmit={create}><label>Nom<input name="name" required /></label><label>Chemin<input name="path" placeholder="/nouvelle-page" /></label><button className="button dark small">Créer</button></form>}<details className="page-seo"><summary>SEO de la page actuelle</summary><form onSubmit={metadata}><label>Nom<input name="name" defaultValue={currentPage.name} required /></label><label>Chemin<input name="path" defaultValue={currentPage.path} disabled={currentPage.path === '/'} /></label><label>Titre SEO<input name="seoTitle" defaultValue={currentPage.seoTitle} maxLength={180} /></label><label>Description SEO<textarea name="seoDescription" defaultValue={currentPage.seoDescription} maxLength={500} rows={3} /></label><button className="button secondary small">Enregistrer le SEO</button></form></details>{error && <div className="alert error">{error}</div>}</>;
}
