import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  closestFontWeight,
  findFontFamilyForStack,
  FONT_FAMILIES,
  FONT_STYLES,
  fontStack,
  fontWeights,
  getFontFamily,
} from '@/lib/fonts/catalog';
import { getDesignSystem, themeCssVariables, themeGlobalCss, withDesignSystem } from '@/lib/document/design-system';
import { createPageDocument } from '@/lib/document/factory';
import { validatePageDocument } from '@/lib/document/validation';

describe('catalogue local de 500 styles typographiques', () => {
  it('expose 50 familles et exactement 10 graisses réelles par famille', () => {
    expect(FONT_FAMILIES).toHaveLength(50);
    expect(FONT_STYLES).toHaveLength(500);
    expect(new Set(FONT_FAMILIES.map((family) => family.id)).size).toBe(50);
    expect(new Set(FONT_STYLES.map((style) => style.id)).size).toBe(500);
    for (const family of FONT_FAMILIES) {
      const weights = fontWeights(family.minWeight, family.maxWeight);
      expect(weights, family.id).toHaveLength(10);
      expect(new Set(weights).size, family.id).toBe(10);
      expect(weights, family.id).toContain(400);
      expect(FONT_STYLES.filter((style) => style.familyId === family.id)).toHaveLength(10);
      for (const weight of weights) {
        expect(weight, family.id).toBeGreaterThanOrEqual(family.minWeight);
        expect(weight, family.id).toBeLessThanOrEqual(family.maxWeight);
      }
      expect(family.source.packageName).toBe(`@fontsource-variable/${family.id}`);
      expect(family.source.license).toBe('OFL-1.1');
    }
  });

  it('conserve un WOFF2 latin et sa licence pour chaque entrée', () => {
    for (const family of FONT_FAMILIES) {
      const asset = fs.readFileSync(path.join(process.cwd(), 'public/fonts', `${family.id}.woff2`));
      expect(asset.subarray(0, 4).toString('ascii'), family.id).toBe('wOF2');
      expect(asset.length, family.id).toBeGreaterThan(1000);
      const license = fs.readFileSync(path.join(process.cwd(), 'public/fonts/licenses', `${family.id}.txt`), 'utf8');
      expect(license, family.id).toContain('SIL OPEN FONT LICENSE');
    }
  });

  it('reconnaît les piles historiques et borne les graisses à la famille', () => {
    expect(findFontFamilyForStack('Inter, ui-sans-serif, system-ui, sans-serif')?.id).toBe('inter');
    expect(findFontFamilyForStack('Arial, sans-serif')).toBeUndefined();
    const instrument = getFontFamily('instrument-sans')!;
    expect(fontStack(instrument)).toBe('"Instrument Sans", Arial, Helvetica, sans-serif');
    expect(closestFontWeight(instrument, 100)).toBe(400);
    expect(closestFontWeight(instrument, 900)).toBe(700);
  });
});

describe('persistance et CSS contrôlé des fontes', () => {
  it('ne change pas les requêtes des anciens thèmes', () => {
    const document = createPageDocument();
    const theme = withDesignSystem(document.theme, getDesignSystem(document.theme));
    expect(theme.designSystem?.tokens.typography.bodyFontWeight).toBeUndefined();
    expect(themeGlobalCss(theme)).not.toContain('url(');
    expect(validatePageDocument(document).success).toBe(true);
  });

  it('déduplique les familles et ne génère que des URLs locales du catalogue', () => {
    const document = createPageDocument();
    const design = getDesignSystem(document.theme);
    const inter = getFontFamily('inter')!;
    design.tokens.typography.bodyFont = fontStack(inter);
    design.tokens.typography.bodyFontWeight = 450;
    design.tokens.typography.headingFont = fontStack(inter);
    design.tokens.typography.headingFontWeight = 700;
    const theme = withDesignSystem(document.theme, design);
    const css = themeGlobalCss(theme);
    expect(css.match(/@font-face/g)).toHaveLength(1);
    expect(css).toContain('src:url("/fonts/inter.woff2") format("woff2")');
    expect(css).toContain('font-weight:100 900');
    expect(css).not.toMatch(/url\(["']?https?:/i);
    expect(themeCssVariables(theme)['--site-body-font-weight']).toBe('450');
    expect(themeCssVariables(theme)['--site-heading-font-weight']).toBe('700');
    expect(validatePageDocument({ ...document, theme }).success).toBe(true);
  });

  it('accepte les axes jusqu’à 1000 mais refuse une graisse invalide ou une fonte injectée', () => {
    const document = createPageDocument();
    const design = getDesignSystem(document.theme);
    design.tokens.typography.bodyFontWeight = 1000;
    document.theme = withDesignSystem(document.theme, design);
    expect(validatePageDocument(document).success).toBe(true);
    design.tokens.typography.bodyFontWeight = 0;
    document.theme = withDesignSystem(document.theme, design);
    expect(validatePageDocument(document).success).toBe(false);
    design.tokens.typography.bodyFontWeight = 400;
    design.tokens.typography.bodyFont = 'Inter;src:url(https://evil.example/font.woff2)';
    document.theme = withDesignSystem(document.theme, design);
    expect(validatePageDocument(document).success).toBe(false);
    expect(themeGlobalCss(document.theme)).not.toContain('evil.example');
  });
});
