/* eslint-disable @next/next/no-img-element -- les images externes arbitraires ne peuvent pas utiliser une allowlist next/image fixe. */
import type { CSSProperties, ReactNode } from 'react';
import type { PageDocument, PageNode, SiteSnapshot, Viewport } from '@/lib/document/types';
import { safeHref } from '@/lib/document/validation';
import { PublicContactForm, PublicOrderButton, PublicReservationForm } from './PublicForms';

export type RenderMode = 'public' | 'preview' | 'editor';
export type RenderContext = { mode: RenderMode; site?: SiteSnapshot; projectId?: string; slug?: string; selectedNodeId?: string | null; onSelect?: (id: string) => void; viewport?: Viewport };

const cssKeys: Record<string, string> = { color: 'color', backgroundColor: 'background-color', fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', lineHeight: 'line-height', letterSpacing: 'letter-spacing', textAlign: 'text-align', paddingTop: 'padding-top', paddingRight: 'padding-right', paddingBottom: 'padding-bottom', paddingLeft: 'padding-left', marginTop: 'margin-top', marginRight: 'margin-right', marginBottom: 'margin-bottom', marginLeft: 'margin-left', gap: 'gap', width: 'width', maxWidth: 'max-width', minHeight: 'min-height', borderRadius: 'border-radius', borderColor: 'border-color', borderWidth: 'border-width', borderStyle: 'border-style', boxShadow: 'box-shadow', opacity: 'opacity' };

function safeCssValue(value: string | number): string | null {
  const text = String(value);
  if (text.length > 300 || /[<>;{}\\]|url\s*\(|expression\s*\(|@import|javascript:/i.test(text)) return null;
  return text;
}

function inlineStyle(node: PageNode, viewport: Viewport = 'desktop'): CSSProperties {
  const source = { ...node.styles, ...(viewport !== 'desktop' ? node.responsive?.[viewport] : {}) };
  const style: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!cssKeys[key] || (typeof value !== 'string' && typeof value !== 'number')) continue;
    const safe = safeCssValue(value);
    if (safe !== null) style[key] = typeof value === 'number' && !['fontWeight', 'lineHeight', 'opacity'].includes(key) ? `${value}px` : value;
  }
  return style as CSSProperties;
}

function responsiveCss(node: PageNode): string {
  const id = node.id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id || !node.responsive) return '';
  return (['tablet', 'mobile'] as const).map((viewport) => {
    const styles = node.responsive?.[viewport];
    if (!styles) return '';
    const declarations = Object.entries(styles).flatMap(([key, value]) => {
      const cssKey = cssKeys[key];
      const safe = typeof value === 'string' || typeof value === 'number' ? safeCssValue(value) : null;
      if (!cssKey || safe === null) return [];
      const normalized = typeof value === 'number' && !['fontWeight', 'lineHeight', 'opacity'].includes(key) ? `${value}px` : safe;
      return [`${cssKey}:${normalized}`];
    }).join(';');
    if (!declarations) return '';
    const width = viewport === 'tablet' ? '1024px' : '640px';
    return `@media(max-width:${width}){[data-node-id="${id}"]{${declarations}}}`;
  }).join('');
}

function text(value: unknown, fallback = ''): string { return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback; }
function list<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function bool(value: unknown): boolean { return value === true; }
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
  if (context.mode === 'editor') return '#';
  const base = context.mode === 'public' ? `/s/${context.slug}` : `/preview/${context.projectId}`;
  return `${base}${safe === '/' ? '' : safe}`;
}
function money(cents: number, currency: string): string {
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}
function SectionTitle({ title, eyebrow }: { title: string; eyebrow?: string }) { return <div className="section-heading">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>; }

function NodeContent({ node, context }: { node: PageNode; context: RenderContext }): ReactNode {
  const p = node.props;
  const interactive = context.mode !== 'editor';
  switch (node.type) {
    case 'page': return <>{node.children?.map((child) => <NodeRenderer key={child.id} node={child} context={context} />)}</>;
    case 'section': return <section className="wb-section"><SectionTitle title={text(p.title)} /><p className="muted">{text(p.description)}</p><div className="section-children">{node.children?.map((child) => <NodeRenderer key={child.id} node={child} context={context} />)}</div></section>;
    case 'header': return <header className="wb-header"><a className="wb-brand" href={link('/', context)}>{text(p.logoText, context.site?.name || 'Woob')}</a>{bool(p.showNavigation) && <nav aria-label="Navigation principale">{context.site?.navigation.map((item) => <a key={item.path} href={link(item.path, context)}>{item.label}</a>)}</nav>}<a className="button secondary small" href={link(p.ctaHref, context)}>{text(p.ctaLabel)}</a></header>;
    case 'hero': {
      const image = assetUrl(p.imageAssetId, p.imageUrl);
      return <section className="wb-hero"><div className="hero-copy"><span className="eyebrow">{text(p.eyebrow)}</span><h1>{text(p.title)}</h1><p>{text(p.description)}</p><div className="button-row">{text(p.primaryLabel) && <a className="button primary" href={link(p.primaryHref, context)}>{text(p.primaryLabel)}</a>}{text(p.secondaryLabel) && <a className="button ghost" href={link(p.secondaryHref, context)}>{text(p.secondaryLabel)}</a>}</div></div>{image ? <img className="hero-image" src={image} alt={text(p.imageAlt)} /> : <div className="hero-art" aria-hidden="true"><span /><span /><span /></div>}</section>;
    }
    case 'heading': {
      const level = Math.min(4, Math.max(1, Number(p.level) || 2));
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      return <Tag className="wb-heading">{text(p.text)}</Tag>;
    }
    case 'text': return <p className={`wb-text ${bool(p.muted) ? 'muted' : ''}`}>{text(p.text)}</p>;
    case 'image': {
      const src = assetUrl(p.assetId, p.src);
      return <figure className="wb-image">{src ? <img src={src} alt={text(p.alt)} loading="lazy" /> : <div className="image-placeholder">Ajoutez une image</div>}{text(p.caption) && <figcaption>{text(p.caption)}</figcaption>}</figure>;
    }
    case 'button': return <a className={`button ${text(p.variant, 'primary')}`} href={link(p.href, context)}>{text(p.label)}</a>;
    case 'features': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="card-grid three">{list<{ title?: string; description?: string; icon?: string }>(p.items).map((item, index) => <article className="feature-card" key={index}><span className="feature-icon" aria-hidden="true">{text(item.icon, '✦').slice(0, 2)}</span><h3>{text(item.title)}</h3><p>{text(item.description)}</p></article>)}</div></section>;
    case 'gallery': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="gallery-grid">{list<{ assetId?: string; src?: string; alt?: string }>(p.images).map((image, index) => { const src = assetUrl(image.assetId, image.src); return src ? <img key={index} src={src} alt={text(image.alt)} loading="lazy" /> : <div className="image-placeholder" key={index}>Image {index + 1}</div>; })}</div></section>;
    case 'testimonials': return <section className="wb-section tinted"><SectionTitle title={text(p.title)} /><div className="card-grid two">{list<{ quote?: string; author?: string; role?: string }>(p.items).map((item, index) => <blockquote key={index}><p>« {text(item.quote)} »</p><footer><strong>{text(item.author)}</strong><span>{text(item.role)}</span></footer></blockquote>)}</div></section>;
    case 'pricing': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="card-grid three">{list<{ name?: string; price?: string; period?: string; description?: string; features?: string[]; ctaLabel?: string; ctaHref?: string; highlighted?: boolean }>(p.items).map((item, index) => <article className={`pricing-card ${item.highlighted ? 'highlighted' : ''}`} key={index}><h3>{text(item.name)}</h3><p>{text(item.description)}</p><div className="price">{text(item.price)} <small>{text(item.period)}</small></div><ul>{list<string>(item.features).map((feature, i) => <li key={i}>{feature}</li>)}</ul><a className={`button ${item.highlighted ? 'primary' : 'secondary'}`} href={link(item.ctaHref, context)}>{text(item.ctaLabel, 'Choisir')}</a></article>)}</div></section>;
    case 'faq': return <section className="wb-section narrow"><SectionTitle title={text(p.title)} /><div className="faq-list">{list<{ question?: string; answer?: string }>(p.items).map((item, index) => <details key={index}><summary>{text(item.question)}</summary><p>{text(item.answer)}</p></details>)}</div></section>;
    case 'contactForm': return interactive ? <PublicContactForm projectId={context.projectId || context.site?.projectId || ''} formKey={text(p.formKey, 'contact')} title={text(p.title)} description={text(p.description)} submitLabel={text(p.submitLabel, 'Envoyer')} /> : <div className="public-form-shell editor-form"><h2>{text(p.title)}</h2><p>{text(p.description)}</p><div className="mock-field">Nom</div><div className="mock-field">Email</div><div className="mock-field tall">Message</div><span className="button primary">{text(p.submitLabel)}</span></div>;
    case 'reservation': return interactive ? <PublicReservationForm projectId={context.projectId || context.site?.projectId || ''} serviceName={text(p.serviceName)} title={text(p.title)} description={text(p.description)} submitLabel={text(p.submitLabel, 'Réserver')} /> : <div className="public-form-shell editor-form"><h2>{text(p.title)}</h2><p>{text(p.description)}</p><div className="mock-field">Date et nombre de personnes</div><span className="button primary">{text(p.submitLabel)}</span></div>;
    case 'cta': return <section className="wb-cta"><span className="eyebrow">Passons à l’action</span><h2>{text(p.title)}</h2><p>{text(p.description)}</p><a className="button light" href={link(p.buttonHref, context)}>{text(p.buttonLabel)}</a></section>;
    case 'footer': return <footer className="wb-footer"><div><strong>{text(p.text)}</strong><p>© {new Date().getFullYear()} · {text(p.copyright)}</p></div><nav aria-label="Pied de page">{list<{ label?: string; href?: string }>(p.links).map((item, index) => <a key={index} href={link(item.href, context)}>{text(item.label)}</a>)}</nav></footer>;
    case 'stats': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="stats-grid">{list<{ value?: string; label?: string }>(p.items).map((item, index) => <div key={index}><strong>{text(item.value)}</strong><span>{text(item.label)}</span></div>)}</div></section>;
    case 'team': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="card-grid three">{list<{ name?: string; role?: string; assetId?: string; src?: string }>(p.items).map((item, index) => { const src = assetUrl(item.assetId, item.src); return <article className="team-card" key={index}>{src ? <img src={src} alt={text(item.name)} /> : <div className="avatar-placeholder">{text(item.name, '?').slice(0, 1)}</div>}<h3>{text(item.name)}</h3><p>{text(item.role)}</p></article>; })}</div></section>;
    case 'blog': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="card-grid three">{(context.site?.posts || []).slice(0, Number(p.limit) || 6).map((post) => <article className="post-card" key={post.id}><span className="eyebrow">Journal</span><h3>{post.title}</h3><p>{post.excerpt}</p><small>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('fr-FR') : ''}</small></article>)}</div>{!context.site?.posts.length && <p className="muted">Les articles publiés apparaîtront ici.</p>}</section>;
    case 'products': return <section className="wb-section"><SectionTitle title={text(p.title)} /><div className="card-grid three">{(context.site?.products || []).slice(0, Number(p.limit) || 12).map((product) => <article className="product-card" key={product.id}><div className="product-visual">{product.imageAssetId ? <img src={`/media/${product.imageAssetId}`} alt="" /> : <span>{product.name.slice(0, 1)}</span>}</div><h3>{product.name}</h3><p>{product.description}</p><strong>{money(product.priceCents, product.currency)}</strong>{interactive && bool(p.showCart) && <PublicOrderButton projectId={context.projectId || context.site?.projectId || ''} productId={product.id} productName={product.name} />}</article>)}</div>{!context.site?.products.length && <p className="muted">Les produits actifs apparaîtront ici.</p>}</section>;
    case 'contact': return <section className="wb-section narrow"><SectionTitle title={text(p.title)} /><address className="contact-card"><p>{text(p.address)}</p><a href={`mailto:${text(p.email)}`}>{text(p.email)}</a><a href={`tel:${text(p.phone)}`}>{text(p.phone)}</a><p>{text(p.hours)}</p></address></section>;
    default: return null;
  }
}

function NodeRenderer({ node, context }: { node: PageNode; context: RenderContext }) {
  const selected = context.selectedNodeId === node.id;
  const css = responsiveCss(node);
  const className = `wb-node wb-node-${node.type} ${context.mode === 'editor' ? 'editor-node' : ''} ${selected ? 'selected' : ''}`;
  return <div className={className} data-node-id={node.id} data-node-type={node.type} style={inlineStyle(node, context.viewport)} onClick={context.mode === 'editor' ? (event) => { event.stopPropagation(); context.onSelect?.(node.id); } : undefined}>
    {css && <style>{css}</style>}<NodeContent node={node} context={context} />
  </div>;
}

export function DocumentRenderer({ document, context = { mode: 'public' } }: { document: PageDocument; context?: RenderContext }) {
  return <div className={`wb-page wb-mode-${context.mode}`} data-testid="document-renderer"><NodeRenderer node={document.root} context={context} /></div>;
}
