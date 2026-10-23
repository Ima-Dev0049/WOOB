import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocumentRenderer } from '@/components/renderer/DocumentRenderer';
import { applyAiProposal } from '@/lib/document/ai';
import {
  contrastRatio, copyNodeStyle, createDefaultDesignSystem, getDesignSystem, normalizeThemeSettings, pasteNodeStyle,
  resetNodeStyle, resolveNodeStateStyle, resolveNodeStyle, setNodeStyle, themeCssVariables, themeGlobalCss, withDesignSystem,
} from '@/lib/document/design-system';
import { createPageDocument, makeNode } from '@/lib/document/factory';
import type { SharedStyle } from '@/lib/document/types';
import { validatePageDocument } from '@/lib/document/validation';

function designWithPreset() {
  const design = createDefaultDesignSystem();
  const preset: SharedStyle = {
    id: 'preset-text', name: 'Texte partagé', componentType: 'text',
    styles: { color: '#112233', fontSize: '20px', padding: '12px' },
    responsive: { tablet: { fontSize: '18px', gap: '8px' }, mobile: { fontSize: '16px' } },
    states: { hover: { color: '#445566' } },
    responsiveStates: { tablet: { hover: { opacity: 0.8 } } },
  };
  design.styles.push(preset);
  return design;
}

describe('design system versionné et compatible', () => {
  it('normalise un ancien document sans changer ses couleurs historiques', () => {
    const legacy = createPageDocument();
    expect(legacy.theme.designSystem).toBeUndefined();
    const result = validatePageDocument(legacy);
    expect(result.issues).toEqual([]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.theme.designSystem?.schemaVersion).toBe('1.0.0');
    expect(result.data.theme.primaryColor).toBe(legacy.theme.primaryColor);
    expect(result.data.theme.designSystem?.tokens.colors.primary).toBe(legacy.theme.primaryColor);
    expect(validatePageDocument(result.data).success).toBe(true);
    expect(normalizeThemeSettings(result.data.theme)).toEqual(result.data.theme);
  });

  it('produit des variables et un CSS global contrôlé avec mode sombre', () => {
    const theme = normalizeThemeSettings(createPageDocument().theme);
    const design = getDesignSystem(theme);
    design.colorMode = 'auto';
    const next = withDesignSystem(theme, design);
    const variables = themeCssVariables(next);
    expect(variables['--site-primary']).toBe(theme.primaryColor);
    expect(variables['--site-button-min-height']).toBe('44px');
    expect(variables.colorScheme).toBe('light dark');
    const css = themeGlobalCss(next);
    expect(css).toContain('prefers-color-scheme:dark');
    expect(css).toContain('prefers-reduced-motion:reduce');
    expect(css).toContain('.woob-theme .wb-cta :is(h2,h3){color:inherit}');
    expect(css).not.toContain('url(');
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
  });
});

describe('héritage, responsive, états et presets', () => {
  it('applique défaut → preset → local → tablette → mobile sans écraser les exceptions', () => {
    const design = designWithPreset();
    const node = makeNode('text');
    node.styleId = 'preset-text';
    node.styles = { color: '#ABCDEF', margin: '4px' };
    node.responsive = { tablet: { fontSize: '17px' }, mobile: { padding: '6px' } };
    expect(resolveNodeStyle(node, 'desktop', design)).toMatchObject({ color: '#ABCDEF', fontSize: '20px', padding: '12px', margin: '4px' });
    expect(resolveNodeStyle(node, 'tablet', design)).toMatchObject({ color: '#ABCDEF', fontSize: '17px', gap: '8px' });
    expect(resolveNodeStyle(node, 'mobile', design)).toMatchObject({ color: '#ABCDEF', fontSize: '17px', padding: '6px', gap: '8px' });
    design.styles[0]!.styles.color = '#000000';
    expect(resolveNodeStyle(node, 'desktop', design).color).toBe('#ABCDEF');
    design.styles[0]!.styles.fontSize = '22px';
    expect(resolveNodeStyle(node, 'desktop', design).fontSize).toBe('22px');
    expect(resolveNodeStateStyle(node, 'tablet', 'hover', design)).toMatchObject({ color: '#445566', opacity: 0.8 });
  });

  it('modifie seulement le niveau demandé et copie/réinitialise profondément', () => {
    const design = designWithPreset();
    const node = makeNode('button');
    node.styles = { color: '#112233', padding: '10px' };
    node.motion = { preset: 'rise', trigger: 'in-view', duration: 460, delay: 30, distance: 24 };
    setNodeStyle(node, 'color', '#445566', 'mobile');
    setNodeStyle(node, 'transform', 'translateY(-2px)', 'mobile', 'hover');
    expect(node.styles.color).toBe('#112233');
    expect(resolveNodeStyle(node, 'mobile', design).color).toBe('#445566');
    expect(resolveNodeStateStyle(node, 'mobile', 'hover', design).transform).toBe('translateY(-2px)');
    setNodeStyle(node, 'color', null, 'mobile');
    expect(node.responsive?.mobile?.color).toBeUndefined();
    expect(node.styles.color).toBe('#112233');
    const snapshot = copyNodeStyle(node);
    const target = makeNode('button');
    pasteNodeStyle(target, snapshot);
    expect(target.styles).toEqual(node.styles);
    expect(target.responsiveStates).toEqual(node.responsiveStates);
    expect(target.motion).toEqual(node.motion);
    snapshot.styles.color = '#FFFFFF';
    snapshot.motion!.preset = 'fade';
    expect(node.styles.color).toBe('#112233');
    expect(node.motion.preset).toBe('rise');
    resetNodeStyle(target);
    expect(target.styles).toEqual({});
    expect(target.responsiveStates).toBeUndefined();
    expect(target.motion).toBeUndefined();
  });

  it('refuse les références de preset cassées ou incompatibles', () => {
    const document = createPageDocument({ nodes: [makeNode('text')] });
    const node = document.root.children![0]!;
    node.styleId = 'missing';
    expect(validatePageDocument(document).success).toBe(false);
    const design = designWithPreset();
    document.theme = withDesignSystem(document.theme, design);
    node.styleId = 'preset-text';
    expect(validatePageDocument(document).success).toBe(true);
    node.type = 'button';
    expect(validatePageDocument(document).success).toBe(false);
  });
});

describe('validation CSS et variables expertes', () => {
  it.each([
    ['backgroundImage', 'url(https://evil.example/x)'],
    ['backgroundImage', 'javascript:alert(1)'],
    ['animationName', 'arbitrary-keyframe'],
    ['display', 'script'],
    ['boxShadow', '0 0 1px red;position:fixed'],
  ])('refuse %s avec une valeur dangereuse', (property, value) => {
    const document = createPageDocument({ nodes: [makeNode('section')] });
    Object.assign(document.root.children![0]!.styles, { [property]: value });
    expect(validatePageDocument(document).success).toBe(false);
  });

  it('accepte les dégradés sans URL et les variables --woob-* sûres', () => {
    const node = makeNode('section');
    node.styles = { backgroundImage: 'linear-gradient(120deg, #112233, #445566)', color: 'var(--woob-brand)' };
    node.cssVariables = { '--woob-brand': '#76552B', '--woob-space': '24px' };
    const result = validatePageDocument(createPageDocument({ nodes: [node] }));
    expect(result.issues).toEqual([]);
    expect(result.success).toBe(true);
    node.cssVariables = { '--site-danger': 'red' };
    expect(validatePageDocument(createPageDocument({ nodes: [node] })).success).toBe(false);
  });
});

describe('IA et renderer partagent le même contrat', () => {
  it('prévisualise un thème et un style sans muter le document source', () => {
    const target = makeNode('button');
    const document = createPageDocument({ nodes: [target] });
    const design = createDefaultDesignSystem();
    design.name = 'Thème IA';
    design.tokens.colors.primary = '#123456';
    const preview = applyAiProposal(document, { summary: 'Thème et bouton proposés', operations: [
      { kind: 'updateTheme', designSystem: design },
      { kind: 'updateStyle', nodeId: target.id, viewport: 'mobile', state: 'hover', styles: { borderRadius: '22px', transform: 'translateY(-2px)' } },
    ] });
    expect(preview.theme.designSystem?.name).toBe('Thème IA');
    expect(preview.theme.primaryColor).toBe('#123456');
    expect(document.theme.designSystem).toBeUndefined();
    expect(resolveNodeStateStyle(preview.root.children![0]!, 'mobile', 'hover', getDesignSystem(preview.theme))).toMatchObject({ borderRadius: '22px', transform: 'translateY(-2px)' });
    expect(target.states).toBeUndefined();
  });

  it('applique les styles au bouton interne et produit les règles responsive/état', () => {
    const button = makeNode('button');
    button.styles = { backgroundColor: '#112233', padding: '14px', borderRadius: '20px' };
    button.responsive = { mobile: { width: '100%' } };
    button.states = { hover: { backgroundColor: '#445566' } };
    const document = createPageDocument({ nodes: [button] });
    const html = renderToStaticMarkup(createElement(DocumentRenderer, { document, context: { mode: 'public' } }));
    expect(html).toContain('<a class="button primary"');
    expect(html).toContain('background-color:#112233');
    expect(html).toContain('@media(max-width:640px)');
    expect(html).toContain(':hover');
    expect(html).toContain('!important');
    expect(html).not.toContain('javascript:');
  });
});
