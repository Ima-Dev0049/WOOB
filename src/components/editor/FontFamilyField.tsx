'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  closestFontWeight,
  findFontFamilyForStack,
  FONT_CATEGORIES,
  FONT_CATEGORY_LABELS,
  FONT_FAMILIES,
  FONT_STYLE_COUNT,
  fontFaceCss,
  fontStack,
  fontWeightName,
  fontWeights,
  getFontFamily,
  type FontCategory,
} from '@/lib/fonts/catalog';

type Props = {
  label: string;
  stack: string;
  weight?: number | undefined;
  defaultWeight?: number;
  onChange: (stack: string, weight: number | undefined) => void;
};

export function FontFamilyField({ label, stack, weight, defaultWeight = 400, onChange }: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FontCategory | 'all'>('all');
  const [previewId, setPreviewId] = useState<string>();
  const selected = findFontFamilyForStack(stack);
  const selectedWeights = selected ? fontWeights(selected.minWeight, selected.maxWeight) : [];
  const currentWeight = selected ? closestFontWeight(selected, weight ?? defaultWeight) : weight ?? defaultWeight;
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr');
    return FONT_FAMILIES.filter((family) => (category === 'all' || family.category === category)
      && (!needle || `${family.name} ${family.id} ${FONT_CATEGORY_LABELS[family.category]}`.toLocaleLowerCase('fr').includes(needle)));
  }, [category, query]);
  const hovered = getFontFamily(previewId ?? '');
  const previewFamilies = [...(selected ? [selected] : []), ...(hovered && hovered.id !== selected?.id ? [hovered] : [])];

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function choose(familyId: string) {
    const family = getFontFamily(familyId);
    if (!family) return;
    onChange(fontStack(family), closestFontWeight(family, currentWeight));
    setPreviewId(family.id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return <div className="font-family-field" onKeyDown={(event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }}>
    <style>{fontFaceCss(previewFamilies)}</style>
    <span className="font-field-label" id={`${id}-label`}>{label}</span>
    <button ref={triggerRef} type="button" className="font-family-trigger" aria-expanded={open} aria-controls={`${id}-catalog`} onClick={() => setOpen((value) => !value)}>
      <span className="font-sr-only">{label}</span>
      <span className="font-family-trigger-preview" style={{ fontFamily: selected ? fontStack(selected) : stack, fontWeight: currentWeight }} aria-hidden="true" />
      <span><strong>{selected?.name ?? 'Police personnalisée'}</strong><small>{selected ? `${selectedWeights.length} graisses · ${selected.minWeight}–${selected.maxWeight}` : 'Pile CSS libre'}</small></span>
      <span className="font-family-chevron" aria-hidden="true" />
    </button>
    {open && <div className="font-catalog" id={`${id}-catalog`} role="group" aria-label={`Catalogue pour ${label}`}>
      <div className="font-catalog-heading"><strong>{FONT_STYLE_COUNT} styles</strong><span>{FONT_FAMILIES.length} familles variables · 10 graisses chacune</span></div>
      <div className="font-catalog-filters">
        <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher…" aria-label={`Rechercher une famille pour ${label}`} />
        <select value={category} onChange={(event) => setCategory(event.target.value as FontCategory | 'all')} aria-label={`Catégorie pour ${label}`}>
          {FONT_CATEGORIES.map((item) => <option key={item} value={item}>{FONT_CATEGORY_LABELS[item]}</option>)}
        </select>
      </div>
      <div className="font-family-results">
        {filtered.map((family) => <button key={family.id} type="button" className={selected?.id === family.id ? 'selected' : ''} aria-pressed={selected?.id === family.id} onPointerEnter={() => setPreviewId(family.id)} onFocus={() => setPreviewId(family.id)} onClick={() => choose(family.id)}>
          <span style={{ fontFamily: fontStack(family), fontWeight: closestFontWeight(family, 500) }}>{family.name}</span>
          <small>{FONT_CATEGORY_LABELS[family.category]} · {family.minWeight}–{family.maxWeight}</small>
        </button>)}
        {!filtered.length && <p>Aucune famille ne correspond à cette recherche.</p>}
      </div>
      <p className="font-catalog-note">Aperçu chargé au survol ou au focus. Le site publié ne charge que les familles choisies.</p>
    </div>}
    <label>Graisse<select aria-label={`Graisse — ${label}`} value={selected ? String(currentWeight) : ''} disabled={!selected} onChange={(event) => {
      if (selected) onChange(stack, Number(event.target.value));
    }}>
      {!selected && <option value="">Automatique</option>}
      {selectedWeights.map((item) => <option key={item} value={item}>{item} · {fontWeightName(item)}</option>)}
    </select></label>
    <label>Pile CSS personnalisée<input aria-label={`${label}, pile CSS personnalisée`} value={stack} maxLength={180} onChange={(event) => onChange(event.target.value, undefined)} /></label>
    <p className="field-hint">La saisie personnalisée reste disponible. Les fontes du catalogue sont locales et sous licence OFL.</p>
  </div>;
}
