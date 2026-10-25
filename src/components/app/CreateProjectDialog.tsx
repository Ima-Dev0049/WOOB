'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client-api';
import { getDictionary, type Dictionary, type UiLocale } from '@/lib/i18n';
import { designStyles, functionalModuleIds, getActivityDomain, getFunctionalModule, getSiteBlueprint, getSiteType, localize, resolveProjectCreation, searchActivityDomains, searchSiteTypes, siteCategories } from '@/lib/catalog';
import type { CreationSelection, FunctionalModuleId, UiLanguage } from '@/lib/catalog/types';
import { withCreativeConcept, type GeneratedProjectDraft } from '@/lib/catalog/generation';
import { themeCssVariables, themeGlobalCss } from '@/lib/document/design-system';
import type { SiteSnapshot } from '@/lib/document/types';
import { DocumentRenderer } from '@/components/renderer/DocumentRenderer';
import { ProjectBriefSummary } from '@/components/app/ProjectBriefSummary';
import { useModalFocus } from '@/components/ui/useModalFocus';

type PreviewResponse = { generationId: string; provider: string; model: string; demo: boolean; draft: GeneratedProjectDraft };
type WizardDictionary = Dictionary['projectDialog']['wizard'];

function DraftPreview({ draft, demo, model, path, onPathChange, onConceptChange, dictionary }: { draft: GeneratedProjectDraft; demo: boolean; model: string; path: string; onPathChange: (path: string) => void; onConceptChange: (conceptId: string) => void; dictionary: WizardDictionary }) {
  const locale = draft.resolved.locale;
  const theme = (draft.pages.find((page) => page.path === path) || draft.pages[0]!).document.theme;
  const selectedDirection = draft.creative.candidates.find((candidate) => candidate.conceptId === draft.creative.selectedId)!;
  const site: SiteSnapshot = {
    publicationId: 'catalog-preview', projectId: 'catalog-preview', slug: 'catalog-preview',
    name: draft.selection.name, description: draft.content.seoDescription, defaultLocale: locale, theme,
    pages: draft.pages.map((page) => ({ id: page.id, name: page.name, path: page.path, seoTitle: page.seoTitle, seoDescription: page.seoDescription, document: page.document })),
    navigation: draft.pages.slice(0, 5).map((page) => ({ label: page.name, path: page.path })),
    products: draft.products.map((product, index) => ({ ...product, id: `preview-product-${index}`, slug: `preview-product-${index}`, imageAssetId: null })),
    posts: draft.posts.map((post, index) => ({ ...post, id: `preview-post-${index}`, slug: `preview-post-${index}`, publishedAt: null })),
    modules: [...draft.resolved.selectedModuleIds], publishedAt: new Date(0).toISOString(),
  };
  const variables = themeCssVariables(theme);
  const current = draft.pages.find((page) => page.path === path) || draft.pages[0]!;
  return <div className="catalog-preview" data-testid="catalog-preview">
    <div className="catalog-preview-meta">
      <span>{demo ? dictionary.localProvider : dictionary.remoteProvider(model)}</span>
      <strong>{draft.resolved.siteType ? localize(draft.resolved.siteType.name, locale) : dictionary.customType} · {localize(draft.resolved.style.name, locale)}</strong>
    </div>
    <ProjectBriefSummary brief={draft.brief} locale={locale} compact />
    <section className="creative-directions" aria-labelledby="creative-directions-title">
      <header><div><span className="eyebrow">Creative Engine</span><h4 id="creative-directions-title">{dictionary.creativeTitle}</h4><p>{dictionary.creativeBody}</p></div><strong>{dictionary.diversity(draft.creative.diversity.score)}</strong></header>
      <div className="creative-concept-grid" role="radiogroup" aria-label={dictionary.creativeTitle}>{draft.creative.candidates.map((candidate) => {
        const evaluation = draft.creative.evaluations.find((item) => item.conceptId === candidate.conceptId);
        const selected = candidate.conceptId === draft.creative.selectedId;
        return <label className={`creative-concept ${selected ? 'selected' : ''}`} key={candidate.conceptId} data-testid={`creative-concept-${candidate.conceptId}`}><input type="radio" name="creative-direction" value={candidate.conceptId} checked={selected} onChange={() => onConceptChange(candidate.conceptId)} /><span className="creative-concept-heading"><strong>{candidate.name}</strong><small>{dictionary.relevance(evaluation?.score ?? 0)}</small></span><p>{candidate.concept}</p><span className="creative-concept-meta">{candidate.composition.heroLayout} · {candidate.typography.scale} · {candidate.motion.preset}</span><span className="creative-concept-swatches" aria-hidden="true">{[candidate.palette.primary, candidate.palette.secondary, candidate.palette.accent, candidate.palette.background].map((color) => <i key={color} style={{ background: color }} />)}</span></label>;
      })}</div>
      <div className="creative-selected-rationale"><strong>{selectedDirection.name}</strong><p>{selectedDirection.rationale}</p><small>{selectedDirection.palette.rationale} {selectedDirection.typography.rationale}</small></div>
      <div className="creative-quality" data-testid="creative-quality"><strong>{dictionary.qualityTitle} · {draft.quality.score}/100</strong><span>{dictionary.contrast(draft.quality.metrics.minimumContrast?.toFixed(2) ?? '—')} · {dictionary.motionNodes(draft.quality.metrics.motionNodes)}</span><p>{dictionary.qualityNote}</p>{draft.quality.issues.filter((issue) => issue.severity !== 'info').map((issue) => <small key={issue.id} role={issue.severity === 'error' ? 'alert' : undefined}>{issue.message}</small>)}</div>
    </section>
    <div className="catalog-preview-pages" aria-label={dictionary.previewPages}>
      {draft.pages.map((page) => <button type="button" key={page.id} className={current.path === page.path ? 'active' : ''} aria-pressed={current.path === page.path} onClick={() => onPathChange(page.path)}>{page.name}<small>{page.path}</small></button>)}
    </div>
    <main className="published-site woob-theme catalog-preview-canvas" style={variables} lang={locale}>
      <style>{themeGlobalCss(theme)}</style>
      <DocumentRenderer document={current.document} context={{ mode: 'preview', site, interactive: false }} />
    </main>
    {draft.resolved.notices.length > 0 && <aside className="catalog-limitations"><strong>{dictionary.limitations}</strong>{draft.resolved.notices.map((notice, index) => <p key={index}>{localize(notice, locale)}</p>)}</aside>}
  </div>;
}

export function CreateProjectDialog({ workspaceId, locale, compact = false }: { workspaceId: string; locale: UiLocale; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState('');
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [siteTypeId, setSiteTypeId] = useState<string | null>(null);
  const [activityDomainId, setActivityDomainId] = useState<string | null>(null);
  const [moduleIds, setModuleIds] = useState<FunctionalModuleId[]>(['forms']);
  const [designStyleId, setDesignStyleId] = useState('professional-clear');
  const [contentLocale, setContentLocale] = useState<UiLanguage>(locale);
  const [brief, setBrief] = useState('');
  const [typeQuery, setTypeQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [domainQuery, setDomainQuery] = useState('');
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [conceptId, setConceptId] = useState('');
  const [previewPath, setPreviewPath] = useState('/');
  const router = useRouter();
  const dict = getDictionary(locale);
  const w = dict.projectDialog.wizard;
  const dialogRef = useModalFocus<HTMLElement>(open, () => { if (!pending) setOpen(false); });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (open && previousStep.current !== step) headingRef.current?.focus();
    previousStep.current = step;
  }, [open, step]);

  const selection = useMemo<CreationSelection>(() => ({ name: name.trim(), brief, siteTypeId, activityDomainId, designStyleId, moduleIds, locale: contentLocale }), [name, brief, siteTypeId, activityDomainId, designStyleId, moduleIds, contentLocale]);
  const resolved = useMemo(() => resolveProjectCreation(selection), [selection]);
  const filteredTypes = useMemo(() => searchSiteTypes({ query: typeQuery, ...(categoryId ? { categoryId } : {}) }), [typeQuery, categoryId]);
  const visibleTypes = filteredTypes.slice(0, 60);
  const filteredDomains = useMemo(() => searchActivityDomains({ query: domainQuery, ...(siteTypeId ? { siteTypeId } : {}), recommendedOnly: recommendedOnly && Boolean(siteTypeId) }), [domainQuery, siteTypeId, recommendedOnly]);
  const previewDraft = useMemo(() => {
    if (!preview) return null;
    return !conceptId || conceptId === preview.draft.creative.selectedId ? preview.draft : withCreativeConcept(preview.draft, conceptId);
  }, [preview, conceptId]);

  function invalidatePreview() { setPreview(null); setConceptId(''); setError(''); }
  function goTo(next: number) { if (next === 6 && !preview) return; setError(''); setStep(Math.max(1, Math.min(6, next))); }
  function chooseType(id: string | null) {
    const blueprint = getSiteBlueprint(id ? getSiteType(id)?.blueprintId || 'custom' : 'custom');
    setSiteTypeId(id);
    setModuleIds([...(blueprint?.recommendedModuleIds || ['forms'])]);
    invalidatePreview();
  }
  function toggleModule(id: FunctionalModuleId, enabled: boolean) {
    setModuleIds((current) => functionalModuleIds.filter((moduleId) => moduleId === id ? enabled : current.includes(moduleId)));
    invalidatePreview();
  }
  async function preparePreview() {
    if (name.trim().length < 2) { setError(w.nameRequired); setStep(1); return; }
    setPending(true); setError('');
    try {
      const result = await apiFetch<PreviewResponse>(`/api/workspaces/${workspaceId}/project-preview`, { method: 'POST', body: JSON.stringify(selection) });
      setPreview(result); setConceptId(result.draft.creative.selectedId); setPreviewPath('/'); setStep(6);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setPending(false); }
  }
  async function create() {
    if (!preview) { setStep(5); return; }
    setPending(true); setError('');
    try {
      const result = await apiFetch<{ project: { id: string } }>(`/api/workspaces/${workspaceId}/projects`, { method: 'POST', headers: { 'Idempotency-Key': requestId }, body: JSON.stringify({ ...selection, generationId: preview.generationId, creativeConceptId: conceptId, requestId }) });
      router.push(`/dashboard/projects/${result.project.id}`);
    } catch (reason) {
      setError(reason instanceof TypeError ? w.retryInterrupted : errorMessage(reason));
      setPending(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (step < 5) goTo(step + 1);
    else if (step === 5) await preparePreview();
    else await create();
  }

  return <><button className={`button ${compact ? 'dark small' : 'coral'}`} onClick={() => { setError(''); setRequestId(crypto.randomUUID()); setOpen(true); }}><span aria-hidden="true">＋</span>{dict.projectDialog.newProject}</button>{open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}><section ref={dialogRef} tabIndex={-1} className="modal create-project-modal catalog-wizard" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
    <header><div><span className="eyebrow">{dict.projectDialog.eyebrow}</span><h2 id="create-project-title">{dict.projectDialog.title}</h2></div><button className="icon-button" disabled={pending} onClick={() => setOpen(false)} aria-label={dict.common.close}>×</button></header>
    <div className="wizard-utility"><span>{w.stepLabel(step)}</span>{step < 5 && <button type="button" className="wizard-skip" onClick={() => goTo(5)}>{w.skip} →</button>}</div>
    <ol className="wizard-steps" aria-label={w.stepLabel(step)}>{w.steps.map((label, index) => { const number = index + 1; return <li key={label}><button type="button" className={step === number ? 'active' : step > number ? 'complete' : ''} aria-current={step === number ? 'step' : undefined} disabled={pending || (number === 6 && !preview)} onClick={() => goTo(number)}><span>{number}</span>{label}</button></li>; })}</ol>
    <form onSubmit={submit} aria-busy={pending}>
      {step === 1 && <section className="wizard-panel"><div className="wizard-heading"><h3 ref={headingRef} tabIndex={-1}>{w.typeTitle}</h3><p>{w.typeBody}</p></div>
        <label>{dict.projectDialog.name}<input name="name" required minLength={2} maxLength={120} value={name} placeholder={dict.projectDialog.namePlaceholder} data-modal-autofocus onChange={(event) => { setName(event.target.value); invalidatePreview(); }} /></label>
        <div className="catalog-filters"><label>{w.searchTypes}<input type="search" value={typeQuery} placeholder={w.searchPlaceholder} onChange={(event) => setTypeQuery(event.target.value)} /></label><label>{w.allCategories}<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">{w.allCategories}</option>{siteCategories.map((category) => <option key={category.id} value={category.id}>{localize(category.name, locale)}</option>)}</select></label></div>
        <p className="catalog-result-count" aria-live="polite">{w.results(Math.min(visibleTypes.length + 1, filteredTypes.length + 1), filteredTypes.length + 1)}</p>
        <div className="catalog-card-grid"><label className={`catalog-choice ${siteTypeId === null ? 'selected' : ''}`}><input type="radio" name="site-type" value="" checked={siteTypeId === null} onChange={() => chooseType(null)} /><strong>{w.customType}</strong><small>{w.customTypeBody}</small></label>{visibleTypes.map((type) => <label className={`catalog-choice ${siteTypeId === type.id ? 'selected' : ''}`} key={type.id}><input type="radio" name="site-type" value={type.id} checked={siteTypeId === type.id} onChange={() => chooseType(type.id)} /><strong>{localize(type.name, locale)}</strong><small>{localize(type.description, locale)}</small>{getSiteBlueprint(type.blueprintId)?.notice && <em>{w.limited}</em>}</label>)}</div>
        {!filteredTypes.length && <p className="catalog-empty">{w.noResults}</p>}{filteredTypes.length > visibleTypes.length && <p className="catalog-empty">{w.results(visibleTypes.length, filteredTypes.length)}</p>}
        {resolved.blueprint.notice && <aside className="catalog-note"><strong>{w.limitations}</strong><p>{localize(resolved.blueprint.notice, contentLocale)}</p></aside>}
      </section>}

      {step === 2 && <section className="wizard-panel"><div className="wizard-heading"><h3 ref={headingRef} tabIndex={-1}>{w.domainTitle}</h3><p>{w.domainBody}</p></div>
        <div className="catalog-filters"><label>{w.searchDomains}<input type="search" value={domainQuery} placeholder={w.searchPlaceholder} onChange={(event) => setDomainQuery(event.target.value)} /></label><label className="wizard-check"><input type="checkbox" disabled={!siteTypeId} checked={recommendedOnly && Boolean(siteTypeId)} onChange={(event) => setRecommendedOnly(event.target.checked)} /><span>{w.recommendedOnly}<small>{w.freeCombination}</small></span></label></div>
        <div className="catalog-card-grid domains"><label className={`catalog-choice ${activityDomainId === null ? 'selected' : ''}`}><input type="radio" name="activity-domain" value="" checked={activityDomainId === null} onChange={() => { setActivityDomainId(null); invalidatePreview(); }} /><strong>{w.noDomain}</strong><small>{w.noDomainBody}</small></label>{filteredDomains.map((domain) => <label className={`catalog-choice ${activityDomainId === domain.id ? 'selected' : ''}`} key={domain.id}><input type="radio" name="activity-domain" value={domain.id} checked={activityDomainId === domain.id} onChange={() => { setActivityDomainId(domain.id); invalidatePreview(); }} />{domain.parentId && <em>{localize(getActivityDomain(domain.parentId)!.name, locale)}</em>}<strong>{localize(domain.name, locale)}</strong><small>{localize(domain.description, locale)}</small><span>{domain.keywords.slice(0, 4).join(' · ')}</span></label>)}</div>
        {!filteredDomains.length && <p className="catalog-empty">{w.noResults}</p>}{!resolved.recommendedByDomain && <aside className="catalog-note">{w.notRecommended}</aside>}
      </section>}

      {step === 3 && <section className="wizard-panel"><div className="wizard-heading"><h3 ref={headingRef} tabIndex={-1}>{w.featuresTitle}</h3><p>{w.featuresBody}</p></div><div className="catalog-module-grid">{resolved.blueprint.supportedModuleIds.map((id) => { const capability = getFunctionalModule(id)!; return <label className={`catalog-choice ${moduleIds.includes(id) ? 'selected' : ''}`} key={id}><input type="checkbox" checked={moduleIds.includes(id)} onChange={(event) => toggleModule(id, event.target.checked)} /><strong>{localize(capability.name, contentLocale)}</strong><small>{localize(capability.description, contentLocale)}</small></label>; })}</div></section>}

      {step === 4 && <section className="wizard-panel"><div className="wizard-heading"><h3 ref={headingRef} tabIndex={-1}>{w.styleTitle}</h3><p>{w.styleBody}</p></div><div className="catalog-style-grid">{designStyles.map((style) => <label className={`catalog-choice ${designStyleId === style.id ? 'selected' : ''}`} key={style.id}><input type="radio" name="design-style" value={style.id} checked={designStyleId === style.id} onChange={() => { setDesignStyleId(style.id); invalidatePreview(); }} /><span className="catalog-style-swatches" aria-hidden="true"><i style={{ background: style.theme.primaryColor }} /><i style={{ background: style.theme.accentColor }} /><i style={{ background: style.theme.secondaryColor }} /></span><strong>{localize(style.name, contentLocale)}</strong><small>{localize(style.description, contentLocale)}</small></label>)}</div></section>}

      {step === 5 && <section className="wizard-panel"><div className="wizard-heading"><h3 ref={headingRef} tabIndex={-1}>{w.descriptionTitle}</h3><p>{w.descriptionBody}</p></div><p className="wizard-project-name">{name}</p><label>{w.briefLabel} <span className="optional">{dict.common.optional}</span><textarea name="brief" rows={7} maxLength={2000} value={brief} placeholder={w.briefPlaceholder} onChange={(event) => { setBrief(event.target.value); invalidatePreview(); }} /></label><label>{w.languageLabel}<select value={contentLocale} onChange={(event) => { setContentLocale(event.target.value === 'en' ? 'en' : 'fr'); invalidatePreview(); }}><option value="fr">Français</option><option value="en">English</option></select></label><p className="catalog-note">{w.generationInfo}</p></section>}

      {step === 6 && preview && previewDraft && <section className="wizard-panel preview-panel"><div className="wizard-heading"><h3 ref={headingRef} tabIndex={-1}>{w.previewTitle}</h3><p>{w.previewBody}</p></div><DraftPreview draft={previewDraft} demo={preview.demo} model={preview.model} path={previewPath} onPathChange={setPreviewPath} onConceptChange={setConceptId} dictionary={w} /></section>}
      {error && <div className="alert error" role="alert">{error}</div>}
      <footer className="wizard-actions"><div><button type="button" className="button ghost" disabled={pending} onClick={() => setOpen(false)}>{dict.common.cancel}</button>{step > 1 && <button type="button" className="button ghost" disabled={pending} onClick={() => goTo(step - 1)}>← {w.back}</button>}</div>{step < 5 ? <button type="button" className="button coral" disabled={pending} onClick={(event) => { event.preventDefault(); goTo(step + 1); }}>{w.next} →</button> : step === 5 ? <button className="button coral" disabled={pending}>{pending ? w.generating : w.generatePreview}</button> : <button className="button coral" disabled={pending || !preview}>{pending ? dict.projectDialog.creating : dict.projectDialog.create}</button>}</footer>
    </form>
  </section></div>}</>;
}
