/* Local, variable font catalog. WOFF2 and OFL texts: public/fonts/. */
export type FontCategory = 'sans' | 'serif' | 'display' | 'mono';

export interface FontFamily {
  readonly id: string;
  readonly name: string;
  readonly category: FontCategory;
  readonly minWeight: number;
  readonly maxWeight: number;
  readonly source: { readonly packageName: string; readonly version: string; readonly license: 'OFL-1.1' };
}

export const FONT_CATEGORIES = ['all', 'sans', 'serif', 'display', 'mono'] as const;
export const FONT_CATEGORY_LABELS: Record<FontCategory | 'all', string> = {
  all: 'Toutes', sans: 'Sans-serif', serif: 'Serif', display: 'Display', mono: 'Monospace',
};

export const FONT_FAMILIES: readonly FontFamily[] = [
  { id: "inter", name: "Inter", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/inter", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "roboto", name: "Roboto", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/roboto", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "open-sans", name: "Open Sans", category: "sans", minWeight: 300, maxWeight: 800, source: { packageName: "@fontsource-variable/open-sans", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "montserrat", name: "Montserrat", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/montserrat", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "nunito", name: "Nunito", category: "sans", minWeight: 200, maxWeight: 1000, source: { packageName: "@fontsource-variable/nunito", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "nunito-sans", name: "Nunito Sans", category: "sans", minWeight: 200, maxWeight: 1000, source: { packageName: "@fontsource-variable/nunito-sans", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "work-sans", name: "Work Sans", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/work-sans", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "source-sans-3", name: "Source Sans 3", category: "sans", minWeight: 200, maxWeight: 900, source: { packageName: "@fontsource-variable/source-sans-3", version: "5.3.1", license: 'OFL-1.1' } },
  { id: "dm-sans", name: "DM Sans", category: "sans", minWeight: 100, maxWeight: 1000, source: { packageName: "@fontsource-variable/dm-sans", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "manrope", name: "Manrope", category: "sans", minWeight: 200, maxWeight: 800, source: { packageName: "@fontsource-variable/manrope", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "urbanist", name: "Urbanist", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/urbanist", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "figtree", name: "Figtree", category: "sans", minWeight: 300, maxWeight: 900, source: { packageName: "@fontsource-variable/figtree", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "public-sans", name: "Public Sans", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/public-sans", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "ibm-plex-sans", name: "IBM Plex Sans", category: "sans", minWeight: 100, maxWeight: 700, source: { packageName: "@fontsource-variable/ibm-plex-sans", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "noto-sans", name: "Noto Sans", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/noto-sans", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "roboto-condensed", name: "Roboto Condensed", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/roboto-condensed", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "roboto-flex", name: "Roboto Flex", category: "sans", minWeight: 100, maxWeight: 1000, source: { packageName: "@fontsource-variable/roboto-flex", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "outfit", name: "Outfit", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/outfit", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "lexend", name: "Lexend", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/lexend", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "space-grotesk", name: "Space Grotesk", category: "sans", minWeight: 300, maxWeight: 700, source: { packageName: "@fontsource-variable/space-grotesk", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "sora", name: "Sora", category: "sans", minWeight: 100, maxWeight: 800, source: { packageName: "@fontsource-variable/sora", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "josefin-sans", name: "Josefin Sans", category: "sans", minWeight: 100, maxWeight: 700, source: { packageName: "@fontsource-variable/josefin-sans", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "exo-2", name: "Exo 2", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/exo-2", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "oswald", name: "Oswald", category: "sans", minWeight: 200, maxWeight: 700, source: { packageName: "@fontsource-variable/oswald", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "rubik", name: "Rubik", category: "sans", minWeight: 300, maxWeight: 900, source: { packageName: "@fontsource-variable/rubik", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "instrument-sans", name: "Instrument Sans", category: "sans", minWeight: 400, maxWeight: 700, source: { packageName: "@fontsource-variable/instrument-sans", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "geist", name: "Geist", category: "sans", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/geist", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "red-hat-text", name: "Red Hat Text", category: "sans", minWeight: 300, maxWeight: 700, source: { packageName: "@fontsource-variable/red-hat-text", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "merriweather", name: "Merriweather", category: "serif", minWeight: 300, maxWeight: 900, source: { packageName: "@fontsource-variable/merriweather", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "playfair-display", name: "Playfair Display", category: "serif", minWeight: 400, maxWeight: 900, source: { packageName: "@fontsource-variable/playfair-display", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "fraunces", name: "Fraunces", category: "serif", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/fraunces", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "libre-baskerville", name: "Libre Baskerville", category: "serif", minWeight: 400, maxWeight: 700, source: { packageName: "@fontsource-variable/libre-baskerville", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "lora", name: "Lora", category: "serif", minWeight: 400, maxWeight: 700, source: { packageName: "@fontsource-variable/lora", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "crimson-pro", name: "Crimson Pro", category: "serif", minWeight: 200, maxWeight: 900, source: { packageName: "@fontsource-variable/crimson-pro", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "source-serif-4", name: "Source Serif 4", category: "serif", minWeight: 200, maxWeight: 900, source: { packageName: "@fontsource-variable/source-serif-4", version: "5.3.1", license: 'OFL-1.1' } },
  { id: "bitter", name: "Bitter", category: "serif", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/bitter", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "cormorant-garamond", name: "Cormorant Garamond", category: "serif", minWeight: 300, maxWeight: 700, source: { packageName: "@fontsource-variable/cormorant-garamond", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "eb-garamond", name: "EB Garamond", category: "serif", minWeight: 400, maxWeight: 800, source: { packageName: "@fontsource-variable/eb-garamond", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "noto-serif", name: "Noto Serif", category: "serif", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/noto-serif", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "noto-serif-display", name: "Noto Serif Display", category: "serif", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/noto-serif-display", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "rokkitt", name: "Rokkitt", category: "serif", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/rokkitt", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "cormorant", name: "Cormorant", category: "serif", minWeight: 300, maxWeight: 700, source: { packageName: "@fontsource-variable/cormorant", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "noto-sans-display", name: "Noto Sans Display", category: "display", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/noto-sans-display", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "red-hat-display", name: "Red Hat Display", category: "display", minWeight: 300, maxWeight: 900, source: { packageName: "@fontsource-variable/red-hat-display", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "cinzel", name: "Cinzel", category: "display", minWeight: 400, maxWeight: 900, source: { packageName: "@fontsource-variable/cinzel", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "fira-code", name: "Fira Code", category: "mono", minWeight: 300, maxWeight: 700, source: { packageName: "@fontsource-variable/fira-code", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "jetbrains-mono", name: "JetBrains Mono", category: "mono", minWeight: 100, maxWeight: 800, source: { packageName: "@fontsource-variable/jetbrains-mono", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "source-code-pro", name: "Source Code Pro", category: "mono", minWeight: 200, maxWeight: 900, source: { packageName: "@fontsource-variable/source-code-pro", version: "5.3.1", license: 'OFL-1.1' } },
  { id: "geist-mono", name: "Geist Mono", category: "mono", minWeight: 100, maxWeight: 900, source: { packageName: "@fontsource-variable/geist-mono", version: "5.3.0", license: 'OFL-1.1' } },
  { id: "inconsolata", name: "Inconsolata", category: "mono", minWeight: 200, maxWeight: 900, source: { packageName: "@fontsource-variable/inconsolata", version: "5.3.0", license: 'OFL-1.1' } },
];

const STANDARD_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** Ten useful, unique positions inside the real variable axis; never invents an out-of-range weight. */
export function fontWeights(minWeight: number, maxWeight: number): number[] {
  const selected = new Set(STANDARD_WEIGHTS.filter((weight) => weight >= minWeight && weight <= maxWeight));
  for (const step of [50, 25, 10, 5, 1]) {
    const candidates: number[] = [];
    for (let weight = Math.ceil(minWeight / step) * step; weight <= maxWeight; weight += step) candidates.push(weight);
    candidates.sort((a, b) => Math.abs(a - 500) - Math.abs(b - 500) || a - b);
    for (const weight of candidates) {
      if (selected.size >= 10) break;
      selected.add(weight);
    }
    if (selected.size >= 10) break;
  }
  if (selected.size !== 10) throw new Error(`Unable to derive ten weights for ${minWeight}-${maxWeight}`);
  return [...selected].sort((a, b) => a - b);
}

export interface FontStyle {
  readonly id: string;
  readonly familyId: string;
  readonly weight: number;
  readonly label: string;
}

const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 450: 'Book', 500: 'Medium',
  600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black',
};

export function fontWeightName(weight: number): string {
  return WEIGHT_NAMES[weight] ?? `Variable ${weight}`;
}

export const FONT_STYLES: readonly FontStyle[] = FONT_FAMILIES.flatMap((family) =>
  fontWeights(family.minWeight, family.maxWeight).map((weight) => ({
    id: `${family.id}-${weight}`, familyId: family.id, weight, label: `${family.name} · ${weight} ${fontWeightName(weight)}`,
  })),
);

export const FONT_STYLE_COUNT = FONT_STYLES.length;

export function getFontFamily(id: string): FontFamily | undefined {
  return FONT_FAMILIES.find((family) => family.id === id);
}

function firstFamily(stack: string): string {
  const first = stack.split(',')[0]?.trim() ?? '';
  return first.replace(/^(['"])(.*)\1$/, '$2').trim().toLowerCase();
}

export function findFontFamilyForStack(stack: string): FontFamily | undefined {
  const candidate = firstFamily(stack);
  return FONT_FAMILIES.find((family) => family.name.toLowerCase() === candidate || family.id === candidate);
}

export function fontStack(family: FontFamily): string {
  const fallback = family.category === 'serif' || family.id === 'cinzel'
    ? 'Georgia, "Times New Roman", serif'
    : family.category === 'mono'
      ? 'ui-monospace, SFMono-Regular, Consolas, monospace'
      : 'Arial, Helvetica, sans-serif';
  return `"${family.name}", ${fallback}`;
}

export function closestFontWeight(family: FontFamily, requested = 400): number {
  return fontWeights(family.minWeight, family.maxWeight).reduce((closest, weight) =>
    Math.abs(weight - requested) < Math.abs(closest - requested) ? weight : closest,
  );
}

export function fontFaceCss(families: readonly FontFamily[]): string {
  return [...new Map(families.map((family) => [family.id, family])).values()].map((family) =>
    `@font-face{font-family:"${family.name}";font-style:normal;font-display:swap;font-weight:${family.minWeight} ${family.maxWeight};src:url("/fonts/${family.id}.woff2") format("woff2")}`,
  ).join('');
}

/** A weight is the explicit opt-in marker, keeping legacy themes free of new network requests. */
export function selectedFontFaceCss(selections: readonly { font: string; weight?: number | undefined }[]): string {
  return fontFaceCss(selections.flatMap((selection) => {
    const family = selection.weight === undefined ? undefined : findFontFamilyForStack(selection.font);
    return family ? [family] : [];
  }));
}
