/* eslint-disable @next/next/no-img-element -- les images externes arbitraires ne peuvent pas utiliser une allowlist next/image fixe. */
import type { CSSProperties, ReactNode } from 'react';
import type { DesignSystem, NodeStyle, PageDocument, PageNode, SiteSnapshot, StyleState, Viewport } from '@/lib/document/types';
import { safeCss, safeCssVariable, safeHref } from '@/lib/document/validation';
import { createDefaultDesignSystem, getDesignSystem, resolveNodeStateStyle, resolveNodeStyle } from '@/lib/document/design-system';
import { PublicContactForm, PublicOrderButton, PublicReservationForm } from './PublicForms';
import { CreativeMotion } from './CreativeMotion';
import { Scene3D } from './Scene3D';

export type RenderMode = 'public' | 'preview' | 'editor' | 'demo';
export type RenderContext = { mode: RenderMode; site?: SiteSnapshot; projectId?: string; slug?: string; selectedNodeId?: string | null; onSelect?: (id: string) => void; viewport?: Viewport; designSystem?: DesignSystem; animateMotion?: boolean; interactive?: boolean };

const UNITLESS = new Set(['fontWeight', 'lineHeight', 'opacity', 'zIndex', 'order', 'flexGrow', 'flexShrink', 'aspectRatio', 'animationIterationCount']);
const TIME_PROPERTIES = new Set(['transitionDuration', 'transitionDelay', 'animationDuration', 'animationDelay']);
const WRAPPER_ONLY = new Set(['position', 'top', 'right', 'bottom', 'left', 'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'transform', 'transformOrigin', 'zIndex']);
const STATE_SELECTORS: Record<StyleState, string> = { hover: ':hover', 'focus-visible': ':focus-within', active: ':active', disabled: ':has([disabled],[aria-disabled="true"])' };

function cssKey(property: string): string { return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`); }
function cssValue(property: string, value: string | number): string {
  if (typeof value === 'string') return value;
  if (UNITLESS.has(property)) return String(value);
  return `${value}${TIME_PROPERTIES.has(property) ? 'ms' : 'px'}`;
}
function styleToCss(style: NodeStyle): CSSProperties {
  const result: Record<string, string | number> = {};
  for (const [property, value] of Object.entries(style)) {
    if ((typeof value === 'string' || typeof value === 'number') && safeCss(property, value)) result[property] = cssValue(property, value);
  }
  return result as CSSProperties;
}
function declarations(style: NodeStyle, important = false): string {
  return Object.entries(style).flatMap(([property, value]) => {
    if ((typeof value !== 'string' && typeof value !== 'number') || !safeCss(property, value)) return [];
    return [`${cssKey(property)}:${cssValue(property, value)}${important ? '!important' : ''}`];
  }).join(';');
}
function variablesToCss(node: PageNode): CSSProperties {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.cssVariables ?? {})) {
    if (/^--woob-[a-z0-9-]{1,80}$/.test(key) && safeCssVariable(value)) result[key] = String(value);
  }
  return result as CSSProperties;
}
function targetsContent(node: PageNode): boolean { return node.type === 'button' || node.type === 'image'; }
function contentSelector(node: PageNode): string { return node.type === 'button' ? ' > a.button' : node.type === 'image' ? ' > .wb-image > img' : ''; }
function splitStyles(node: PageNode, style: NodeStyle): { wrapper: NodeStyle; content: NodeStyle } {
  if (!targetsContent(node)) return { wrapper: style, content: {} };
  const wrapper: NodeStyle = {}; const content: NodeStyle = {};
  for (const [property, value] of Object.entries(style)) {
    if (value === undefined) continue;
    if (WRAPPER_ONLY.has(property)) (wrapper as Record<string, string | number>)[property] = value;
    else (content as Record<string, string | number>)[property] = value;
  }
  return { wrapper, content };
}
function inlineStyles(node: PageNode, viewport: Viewport, design: DesignSystem): { wrapper: CSSProperties; content: CSSProperties | undefined } {
  const split = splitStyles(node, resolveNodeStyle(node, viewport, design));
  return { wrapper: { ...styleToCss(split.wrapper), ...variablesToCss(node) }, content: targetsContent(node) ? styleToCss(split.content) : undefined };
}

function responsiveCss(node: PageNode, design: DesignSystem, mode: RenderMode, editorViewport: Viewport): string {
  const id = node.id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id) return '';
  const selector = `[data-node-id="${id}"]`;
  const rules: string[] = [];
  if (mode !== 'editor') {
    for (const viewport of ['tablet', 'mobile'] as const) {
      const split = splitStyles(node, resolveNodeStyle(node, viewport, design));
      const width = design.tokens.breakpoints[viewport];
      const wrapper = declarations(split.wrapper, true); const content = declarations(split.content, true);
      if (wrapper) rules.push(`@media(max-width:${width}px){${selector}{${wrapper}}}`);
      if (content) rules.push(`@media(max-width:${width}px){${selector}${contentSelector(node)}{${content}}}`);
    }
  }
  const stateViewports = mode === 'editor' ? [editorViewport] : ['desktop', 'tablet', 'mobile'] as const;
  for (const viewport of stateViewports) {
    for (const state of ['hover', 'focus-visible', 'active', 'disabled'] as const) {
      const style = resolveNodeStateStyle(node, viewport, state, design);
      const body = declarations(style, true);
      if (!body) continue;
      const suffix = contentSelector(node);
      const stateSelector = state === 'focus-visible' && suffix
        ? `${selector}${suffix}:focus-visible`
        : `${selector}${STATE_SELECTORS[state]}${suffix}`;
      const rule = `${stateSelector}{${body}}`;
      rules.push(mode === 'editor' || viewport === 'desktop' ? rule : `@media(max-width:${design.tokens.breakpoints[viewport]}px){${rule}}`);
    }
  }
  return rules.join('');
}

function text(value: unknown, fallback = ''): string { return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback; }
function list<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function bool(value: unknown): boolean { return value === true; }
function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T { return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback; }
function imageSource(value: unknown): string {
  const safe = safeHref(value);
  if (safe === '#' || safe.startsWith('#') || safe.startsWith('mailto:') || safe.startsWith('tel:')) return '';
  return safe;
}
function assetUrl(assetId: unknown, fallback: unknown): string {
  const id = text(assetId);
  return /^[a-f0-9-]{36}$/i.test(id) ? `/media/${id}` : imageSource(fallback);
}
function link(href: unknown, context: RenderContext): string {
  const safe = safeHref(href);
  if (safe === '#' || !safe.startsWith('/') || safe.startsWith('//')) return safe;
  if (context.mode === 'editor' || context.interactive === false) return '#';
  const base = context.mode === 'public' ? `/s/${context.slug}` : context.mode === 'demo' ? `/demos/${context.slug}` : `/preview/${context.projectId}`;
  return `${base}${safe === '/' ? '' : safe}`;
}
function money(cents: number, currency: string): string {
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}
function SectionTitle({ title, eyebrow }: { title: string; eyebrow?: string }) { return <div className="section-heading">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>; }

function NodeContent({ node, context, componentStyle }: { node: PageNode; context: RenderContext; componentStyle: CSSProperties | undefined }): ReactNode {
  const p = node.props;
  const interactive = context.interactive ?? context.mode !== 'editor';
  switch (node.type) {
    case 'page': return <>{node.children?.map((child) => <NodeRenderer key={child.id} node={child} context={context} />)}</>;
    case 'section': return <section className="wb-section"><SectionTitle title={text(p.title)} /><p className="muted">{text(p.description)}</p><div className="section-children">{node.children?.map((child) => <NodeRenderer key={child.id} node={child} context={context} />)}</div></section>;
    case 'header': return <header className="wb-header"><a className="wb-brand" href={link('/', context)}>{text(p.logoText, context.site?.name || 'Woob')}</a>{bool(p.showNavigation) && <nav aria-label="Navigation principale">{context.site?.navigation.map((item) => <a key={item.path} href={link(item.path, context)}>{item.label}</a>)}</nav>}<a className="button secondary small" href={link(p.ctaHref, context)}>{text(p.ctaLabel)}</a></header>;
    case 'hero': {
      const image = assetUrl(p.imageAssetId, p.imageUrl);
      const layout = enumValue(p.layout, ['split', 'editorial', 'immersive', 'monumental', 'product-stage'] as const, 'split');
      const treatment = enumValue(p.visualTreatment, ['plain', 'organic', 'framed', 'orbital', 'duotone', 'product'] as const, 'plain');
      return <section className={`wb-hero wb-hero-${layout}`}><div className="hero-copy"><span className="eyebrow">{text(p.eyebrow)}</span><h1>{text(p.title)}</h1><p>{text(p.description)}</p><div className="button-row">{text(p.primaryLabel) && <a className="button primary" href={link(p.primaryHref, context)}>{text(p.primaryLabel)}</a>}{text(p.secondaryLabel) && <a className="button ghost" href={link(p.secondaryHref, context)}>{text(p.secondaryLabel)}</a>}</div></div><div className={`hero-visual treatment-${treatment}`}>{image ? <img className="hero-image" src={image} alt={text(p.imageAlt)} fetchPriority="high" decoding="async" /> : <div className="hero-art" aria-hidden="true"><span /><span /><span /></div>}</div></section>;
    }
    case 'heading': {
      const level = Math.min(4, Math.max(1, Number(p.level) || 2));
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      return <Tag className="wb-heading">{text(p.text)}</Tag>;
    }
    case 'text': return <p className={`wb-text ${bool(p.muted) ? 'muted' : ''}`}>{text(p.text)}</p>;
    case 'image': {
      const src = assetUrl(p.assetId, p.src);
      return <figure className="wb-image">{src ? <img src={src} alt={text(p.alt)} loading="lazy" style={componentStyle} /> : <div className="image-placeholder">Ajoutez une image</div>}{text(p.caption) && <figcaption>{text(p.caption)}</figcaption>}</figure>;
    }
    case 'button': return <a className={`button ${text(p.variant, 'primary')}`} href={link(p.href, context)} style={componentStyle}>{text(p.label)}</a>;
    case 'features': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className={`card-grid three features-${enumValue(p.layout, ['cards', 'editorial', 'minimal'] as const, 'cards')}`}>{list<{ title?: string; description?: string; icon?: string }>(p.items).map((item, index) => <article className="feature-card" key={index}><span className="feature-icon" aria-hidden="true">{text(item.icon, '✦').slice(0, 2)}</span><h3>{text(item.title)}</h3><p>{text(item.description)}</p></article>)}</div></section>;
    case 'gallery': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className={`gallery-grid gallery-${enumValue(p.layout, ['grid', 'editorial', 'filmstrip'] as const, 'grid')}`}>{list<{ assetId?: string; src?: string; alt?: string }>(p.images).map((image, index) => { const src = assetUrl(image.assetId, image.src); return src ? <img key={index} src={src} alt={text(image.alt)} loading="lazy" /> : <div className="image-placeholder" key={index}>Image {index + 1}</div>; })}</div></section>;
    case 'testimonials': return <section className="wb-section tinted"><SectionTitle title={text(p.title)} /><div className="card-grid two">{list<{ quote?: string; author?: string; role?: string }>(p.items).map((item, index) => <blockquote key={index}><p>« {text(item.quote)} »</p><footer><strong>{text(item.author)}</strong><span>{text(item.role)}</span></footer></blockquote>)}</div></section>;
    case 'pricing': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="card-grid three">{list<{ name?: string; price?: string; period?: string; description?: string; features?: string[]; ctaLabel?: string; ctaHref?: string; highlighted?: boolean }>(p.items).map((item, index) => <article className={`pricing-card ${item.highlighted ? 'highlighted' : ''}`} key={index}><h3>{text(item.name)}</h3><p>{text(item.description)}</p><div className="price">{text(item.price)} <small>{text(item.period)}</small></div><ul>{list<string>(item.features).map((feature, i) => <li key={i}>{feature}</li>)}</ul><a className={`button ${item.highlighted ? 'primary' : 'secondary'}`} href={link(item.ctaHref, context)}>{text(item.ctaLabel, 'Choisir')}</a></article>)}</div></section>;
    case 'faq': return <section className="wb-section narrow"><SectionTitle title={text(p.title)} /><div className="faq-list">{list<{ question?: string; answer?: string }>(p.items).map((item, index) => <details key={index}><summary>{text(item.question)}</summary><p>{text(item.answer)}</p></details>)}</div></section>;
    case 'contactForm': return interactive && context.mode !== 'demo' ? <PublicContactForm projectId={context.projectId || context.site?.projectId || ''} formKey={text(p.formKey, 'contact')} title={text(p.title)} description={text(p.description)} submitLabel={text(p.submitLabel, 'Envoyer')} /> : <div className="public-form-shell editor-form" data-demo-inactive={context.mode === 'demo' ? 'true' : undefined}><h2>{text(p.title)}</h2><p>{text(p.description)}</p>{context.mode === 'demo' && <p className="demo-form-notice"><strong>Mode démonstration.</strong> Ce formulaire est inactif : aucune donnée n’est collectée.</p>}<div className="mock-field">Nom</div><div className="mock-field">Email</div><div className="mock-field tall">Message</div><span className="button primary" aria-disabled="true">{text(p.submitLabel)}</span></div>;
    case 'reservation': return interactive && context.mode !== 'demo' ? <PublicReservationForm projectId={context.projectId || context.site?.projectId || ''} serviceName={text(p.serviceName)} title={text(p.title)} description={text(p.description)} submitLabel={text(p.submitLabel, 'Réserver')} /> : <div className="public-form-shell editor-form" data-demo-inactive={context.mode === 'demo' ? 'true' : undefined}><h2>{text(p.title)}</h2><p>{text(p.description)}</p>{context.mode === 'demo' && <p className="demo-form-notice"><strong>Mode démonstration.</strong> Ce formulaire est inactif : aucune demande n’est enregistrée.</p>}<div className="mock-field">Date et nombre de personnes</div><span className="button primary" aria-disabled="true">{text(p.submitLabel)}</span></div>;
    case 'cta': return <section className="wb-cta"><span className="eyebrow">Passons à l’action</span><h2>{text(p.title)}</h2><p>{text(p.description)}</p><a className="button light" href={link(p.buttonHref, context)}>{text(p.buttonLabel)}</a></section>;
    case 'footer': return <footer className="wb-footer"><div><strong>{text(p.text)}</strong><p>© {new Date().getFullYear()} · {text(p.copyright)}</p></div><nav aria-label="Pied de page">{list<{ label?: string; href?: string }>(p.links).map((item, index) => <a key={index} href={link(item.href, context)}>{text(item.label)}</a>)}</nav></footer>;
    case 'stats': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="stats-grid">{list<{ value?: string; label?: string }>(p.items).map((item, index) => <div key={index}><strong>{text(item.value)}</strong><span>{text(item.label)}</span></div>)}</div></section>;
    case 'team': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="card-grid three">{list<{ name?: string; role?: string; assetId?: string; src?: string }>(p.items).map((item, index) => { const src = assetUrl(item.assetId, item.src); return <article className="team-card" key={index}>{src ? <img src={src} alt={text(item.name)} /> : <div className="avatar-placeholder">{text(item.name, '?').slice(0, 1)}</div>}<h3>{text(item.name)}</h3><p>{text(item.role)}</p></article>; })}</div></section>;
    case 'blog': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="card-grid three">{(context.site?.posts || []).slice(0, Number(p.limit) || 6).map((post) => <article className="post-card" key={post.id}><span className="eyebrow">Journal</span><h3>{post.title}</h3><p>{post.excerpt}</p><small>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('fr-FR') : ''}</small></article>)}</div>{!context.site?.posts.length && <p className="muted">Les articles publiés apparaîtront ici.</p>}</section>;
    case 'products': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="card-grid three">{(context.site?.products || []).slice(0, Number(p.limit) || 12).map((product) => <article className="product-card" key={product.id}><div className="product-visual">{product.imageAssetId ? <img src={`/media/${product.imageAssetId}`} alt="" /> : <span>{product.name.slice(0, 1)}</span>}</div><h3>{product.name}</h3><p>{product.description}</p><strong>{money(product.priceCents, product.currency)}</strong>{interactive && context.mode !== 'demo' && bool(p.showCart) && <PublicOrderButton projectId={context.projectId || context.site?.projectId || ''} productId={product.id} productName={product.name} />}</article>)}</div>{!context.site?.products.length && <p className="muted">Les produits actifs apparaîtront ici.</p>}</section>;
    case 'contact': return <section className="wb-section narrow"><SectionTitle title={text(p.title)} /><address className="contact-card"><p>{text(p.address)}</p><a href={`mailto:${text(p.email)}`}>{text(p.email)}</a><a href={`tel:${text(p.phone)}`}>{text(p.phone)}</a><p>{text(p.hours)}</p></address></section>;
    case 'scene3d': return <Scene3D title={text(p.title)} description={text(p.description)} preset={enumValue(p.preset, ['orbital', 'prism'] as const, 'orbital')} quality={enumValue(p.quality, ['low', 'balanced'] as const, 'low')} autoRotate={bool(p.autoRotate)} interactive={bool(p.interactive)} fallbackSrc={assetUrl(p.fallbackAssetId, p.fallbackSrc)} fallbackAlt={text(p.fallbackAlt, 'Alternative statique de la scène procédurale.')} webglEnabled={context.interactive !== false} editor={context.mode === 'editor'} forceReducedMotion={context.designSystem?.motion.reducedMotion === 'reduce'} />;
    default: return null;
  }
}

function NodeRenderer({ node, context }: { node: PageNode; context: RenderContext }) {
  const selected = context.selectedNodeId === node.id;
  const design = context.designSystem ?? createDefaultDesignSystem();
  const css = responsiveCss(node, design, context.mode, context.viewport ?? 'desktop');
  const styles = inlineStyles(node, context.viewport ?? 'desktop', design);
  const className = `wb-node wb-node-${node.type} ${context.mode === 'editor' ? 'editor-node' : ''} ${selected ? 'selected' : ''}`;
  const motionStyles = node.motion ? {
    '--woob-motion-duration': `${Math.min(1600, Math.max(100, Number(node.motion.duration) || 460))}ms`,
    '--woob-motion-delay': `${Math.min(1200, Math.max(0, Number(node.motion.delay) || 0))}ms`,
    '--woob-motion-distance': `${Math.min(96, Math.max(0, Number(node.motion.distance) || 0))}px`,
  } as CSSProperties : undefined;
  return <div className={className} data-node-id={node.id} data-node-type={node.type} data-motion-preset={node.motion?.preset} data-motion-trigger={node.motion?.trigger} data-motion-distance={node.motion?.distance} style={{ ...styles.wrapper, ...motionStyles }} onClick={context.mode === 'editor' ? (event) => { event.stopPropagation(); context.onSelect?.(node.id); } : undefined}>
    {css && <style>{css}</style>}<NodeContent node={node} context={context} componentStyle={styles.content} />
  </div>;
}

export function DocumentRenderer({ document, context = { mode: 'public' } }: { document: PageDocument; context?: RenderContext }) {
  const renderContext: RenderContext = { ...context, designSystem: getDesignSystem(document.theme) };
  const direction = document.theme.creativeDirection;
  const motionKey = `${direction?.conceptId || 'legacy'}:${document.revision}`;
  return <CreativeMotion enabled={context.mode !== 'editor' || context.animateMotion === true} reduceMotion={renderContext.designSystem?.motion.reducedMotion === 'reduce'} heroExperience={renderContext.designSystem?.motion.entrance === 'none'} motionKey={motionKey}><div className={`wb-page wb-mode-${context.mode} ${direction ? `creative-mode-${direction.palette.mode}` : ''}`} data-testid="document-renderer" data-creative-concept={direction?.conceptId}><NodeRenderer node={document.root} context={renderContext} /></div></CreativeMotion>;
}
