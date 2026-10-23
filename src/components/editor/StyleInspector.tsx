'use client';

import { useId, useState } from 'react';
import type { EditorMode, PageNode, StyleProperty, StyleState, ThemeSettings, Viewport } from '@/lib/document/types';
import { getDesignSystem, resolveNodeStateStyle, resolveNodeStyle } from '@/lib/document/design-system';
import { safeCss, safeCssVariable } from '@/lib/document/validation';

export type StyleActions = {
  onChange: (property: StyleProperty, value: string | number | null, state?: StyleState) => void;
  onCopy: () => void;
  onPaste: () => void;
  canPaste: boolean;
  onReset: () => void;
  onAssign: (styleId: string) => void;
  onSavePreset: (name: string) => void;
  onApplyToType: () => void;
  onVariableChange: (key: string, value: string | number | null) => void;
};

type Props = { node: PageNode; viewport: Viewport; mode: EditorMode; theme: ThemeSettings; actions: StyleActions };
type FieldConfig = { property: StyleProperty; label: string; options?: [string, string][]; color?: boolean; placeholder?: string };

const OPTIONS = {
  align: [['', 'Hérité'], ['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite'], ['justify', 'Justifié']] as [string, string][],
  display: [['', 'Hérité'], ['block', 'Bloc'], ['flex', 'Flex'], ['grid', 'Grille'], ['inline-block', 'Bloc en ligne'], ['none', 'Masqué']] as [string, string][],
  position: [['', 'Hérité'], ['relative', 'Relative'], ['absolute', 'Absolue'], ['sticky', 'Collante'], ['fixed', 'Fixe'], ['static', 'Normale']] as [string, string][],
  overflow: [['', 'Hérité'], ['visible', 'Visible'], ['hidden', 'Masqué'], ['clip', 'Rogne'], ['auto', 'Automatique'], ['scroll', 'Défilant']] as [string, string][],
  border: [['', 'Hérité'], ['none', 'Aucune'], ['solid', 'Pleine'], ['dashed', 'Tirets'], ['dotted', 'Pointillés']] as [string, string][],
};

function Field({ config, value, onChange, showReset }: { config: FieldConfig; value: string | number | undefined; onChange: (value: string | null) => void; showReset: boolean }) {
  const serialized = String(value ?? '');
  const [local, setLocal] = useState({ base: serialized, draft: serialized, invalid: false });
  const synchronized = local.base === serialized;
  const draft = synchronized ? local.draft : serialized;
  const invalid = synchronized ? local.invalid : false;
  function update(next: string) {
    if (!next) { setLocal({ base: serialized, draft: '', invalid: false }); onChange(null); return; }
    const valid = safeCss(config.property, next);
    setLocal({ base: serialized, draft: next, invalid: !valid });
    if (valid) onChange(next);
  }
  const id = `style-${config.property}-${useId().replace(/:/g, '')}`;
  if (config.options) return <div className="style-field"><label htmlFor={id}>{config.label}</label><div><select id={id} data-testid={id} value={serialized} onChange={(event) => onChange(event.target.value || null)}>{config.options.map(([option, label]) => <option key={option} value={option}>{label}</option>)}</select>{showReset && <button type="button" onClick={() => onChange(null)} aria-label={`Réinitialiser ${config.label}`}>↺</button>}</div></div>;
  return <div className="style-field"><label htmlFor={id}>{config.label}</label><div className={config.color ? 'style-color-input' : ''}>{config.color && <input type="color" aria-label={`${config.label}, sélecteur`} value={/^#[\da-f]{6}$/i.test(serialized) ? serialized : '#172033'} onChange={(event) => update(event.target.value)} />}<input id={id} data-testid={id} value={draft} placeholder={config.placeholder} aria-invalid={invalid} onChange={(event) => update(event.target.value)} onBlur={() => { if (invalid) setLocal({ base: serialized, draft: serialized, invalid: false }); }} />{showReset && <button type="button" onClick={() => { setLocal({ base: serialized, draft: '', invalid: false }); onChange(null); }} aria-label={`Réinitialiser ${config.label}`}>↺</button>}</div>{invalid && <small className="field-error">Valeur non autorisée ou incomplète</small>}</div>;
}

function Group({ title, fields, values, onChange, mode }: { title: string; fields: FieldConfig[]; values: Record<string, string | number | undefined>; onChange: StyleActions['onChange']; mode: EditorMode }) {
  return <details className="inspector-section style-disclosure"><summary>{title}</summary><div className="inspector-section-body">{fields.map((field) => <Field key={field.property} config={field} value={values[field.property]} onChange={(value) => onChange(field.property, value)} showReset={mode !== 'simple'} />)}</div></details>;
}

function CssVariables({ node, onChange }: { node: PageNode; onChange: StyleActions['onVariableChange'] }) {
  const [key, setKey] = useState('--woob-'); const [value, setValue] = useState(''); const [error, setError] = useState('');
  function add() {
    if (!/^--woob-[a-z0-9-]{1,80}$/.test(key) || !safeCssVariable(value) || !value.trim()) { setError('Nom --woob-* ou valeur invalide.'); return; }
    onChange(key, value); setKey('--woob-'); setValue(''); setError('');
  }
  return <details className="inspector-section style-disclosure"><summary>Variables CSS expertes</summary><div className="inspector-section-body"><p className="field-hint">Uniquement des propriétés personnalisées `--woob-*`. Elles sont héritées par le bloc et utilisables avec `var()`.</p>{Object.entries(node.cssVariables ?? {}).map(([name, current]) => <div className="css-variable-row" key={name}><code>{name}</code><input aria-label={`Valeur de ${name}`} value={String(current)} onChange={(event) => { if (safeCssVariable(event.target.value)) onChange(name, event.target.value); }} /><button type="button" onClick={() => onChange(name, null)} aria-label={`Supprimer ${name}`}>×</button></div>)}<div className="css-variable-add"><input aria-label="Nouvelle variable CSS" value={key} onChange={(event) => setKey(event.target.value)} /><input aria-label="Valeur de la nouvelle variable" value={value} onChange={(event) => setValue(event.target.value)} placeholder="16px ou #76552B" /><button type="button" className="button secondary small" onClick={add}>Ajouter</button></div>{error && <small className="field-error" role="alert">{error}</small>}<p className="field-hint">Aucun sélecteur, déclaration libre, script ou chargement `url()` n’est accepté.</p></div></details>;
}

export function StyleInspector({ node, viewport, mode, theme, actions }: Props) {
  const [state, setState] = useState<StyleState | undefined>(); const [presetName, setPresetName] = useState('');
  const design = getDesignSystem(theme);
  const base = resolveNodeStyle(node, viewport, design);
  const values: Record<string, string | number | undefined> = state ? { ...base, ...resolveNodeStateStyle(node, viewport, state, design) } : base;
  const change: StyleActions['onChange'] = (property, value) => actions.onChange(property, value, state);
  const essentials: FieldConfig[] = node.type === 'image'
    ? [{ property: 'width', label: 'Largeur', placeholder: '100%, 320px…' }, { property: 'aspectRatio', label: 'Ratio', placeholder: '16 / 9' }, { property: 'objectFit', label: 'Ajustement', options: [['', 'Hérité'], ['cover', 'Cover'], ['contain', 'Contain'], ['fill', 'Remplir'], ['none', 'Original']] }, { property: 'objectPosition', label: 'Position du sujet', placeholder: '50% 50%' }, { property: 'borderRadius', label: 'Arrondi' }]
    : node.type === 'button'
      ? [{ property: 'color', label: 'Texte', color: true }, { property: 'backgroundColor', label: 'Fond', color: true }, { property: 'fontSize', label: 'Taille du texte' }, { property: 'borderRadius', label: 'Forme / arrondi' }, { property: 'padding', label: 'Espacement intérieur' }, { property: 'width', label: 'Largeur', placeholder: 'auto ou 100%' }]
      : [{ property: 'color', label: 'Texte', color: true }, { property: 'backgroundColor', label: 'Fond', color: true }, { property: 'fontSize', label: 'Taille du texte' }, { property: 'textAlign', label: 'Alignement', options: OPTIONS.align }, { property: 'padding', label: 'Espacement intérieur' }, { property: 'borderRadius', label: 'Arrondi' }];
  const presets = design.styles.filter((style) => !style.componentType || style.componentType === node.type);
  return <>
    <section className="inspector-section style-toolbar-section"><h3>Style {viewport !== 'desktop' && <span>{viewport === 'mobile' ? 'Mobile' : 'Tablette'}</span>}</h3>{mode !== 'simple' && <label>État à modifier<select aria-label="État du style" value={state ?? ''} onChange={(event) => setState((event.target.value || undefined) as StyleState | undefined)}><option value="">Normal</option><option value="hover">Survol</option><option value="focus-visible">Focus clavier</option><option value="active">Actif / clic</option><option value="disabled">Désactivé</option></select></label>}<p className="field-hint">Valeurs effectives héritées. Une modification crée seulement une surcharge {viewport === 'desktop' ? 'ordinateur' : viewport === 'mobile' ? 'mobile' : 'tablette'}{state ? ` pour l’état ${state}` : ''}.</p>{essentials.map((field) => <Field key={field.property} config={field} value={values[field.property]} onChange={(value) => change(field.property, value)} showReset={mode !== 'simple'} />)}</section>
    {mode !== 'simple' && <>
      <Group title="Dimensions et espacements" fields={[{ property: 'width', label: 'Largeur' }, { property: 'minWidth', label: 'Largeur minimale' }, { property: 'maxWidth', label: 'Largeur maximale' }, { property: 'height', label: 'Hauteur' }, { property: 'minHeight', label: 'Hauteur minimale' }, { property: 'maxHeight', label: 'Hauteur maximale' }, { property: 'margin', label: 'Marges extérieures' }, { property: 'padding', label: 'Marges intérieures' }, { property: 'gap', label: 'Espacement des enfants' }, { property: 'aspectRatio', label: 'Rapport largeur / hauteur' }]} values={values} onChange={change} mode={mode} />
      <Group title="Grille, flexbox et position" fields={[{ property: 'display', label: 'Affichage', options: OPTIONS.display }, { property: 'flexDirection', label: 'Direction flex', options: [['', 'Hérité'], ['row', 'Ligne'], ['column', 'Colonne'], ['row-reverse', 'Ligne inverse'], ['column-reverse', 'Colonne inverse']] }, { property: 'flexWrap', label: 'Retour flex', options: [['', 'Hérité'], ['nowrap', 'Aucun'], ['wrap', 'Wrap'], ['wrap-reverse', 'Wrap inverse']] }, { property: 'justifyContent', label: 'Alignement horizontal', placeholder: 'center, space-between…' }, { property: 'alignItems', label: 'Alignement vertical', placeholder: 'center, stretch…' }, { property: 'gridTemplateColumns', label: 'Colonnes de grille', placeholder: 'repeat(3, 1fr)' }, { property: 'gridColumn', label: 'Placement en colonne' }, { property: 'order', label: 'Ordre' }, { property: 'position', label: 'Position', options: OPTIONS.position }, { property: 'zIndex', label: 'Niveau de couche' }, { property: 'overflow', label: 'Débordement', options: OPTIONS.overflow }]} values={values} onChange={change} mode={mode} />
      <Group title="Typographie détaillée" fields={[{ property: 'fontFamily', label: 'Famille de police' }, { property: 'fontWeight', label: 'Graisse', placeholder: '400 à 900' }, { property: 'fontStyle', label: 'Style', options: [['', 'Hérité'], ['normal', 'Normal'], ['italic', 'Italique'], ['oblique', 'Oblique']] }, { property: 'lineHeight', label: 'Hauteur de ligne' }, { property: 'letterSpacing', label: 'Espacement des lettres' }, { property: 'wordSpacing', label: 'Espacement des mots' }, { property: 'textTransform', label: 'Casse', options: [['', 'Hérité'], ['none', 'Normale'], ['uppercase', 'Majuscules'], ['lowercase', 'Minuscules'], ['capitalize', 'Capitalisation']] }, { property: 'textDecoration', label: 'Décoration', placeholder: 'none, underline, line-through' }, { property: 'textIndent', label: 'Retrait de première ligne' }, { property: 'hyphens', label: 'Césure', options: [['', 'Hérité'], ['none', 'Aucune'], ['manual', 'Manuelle'], ['auto', 'Automatique']] }, { property: 'overflowWrap', label: 'Retour à la ligne', options: [['', 'Hérité'], ['normal', 'Normal'], ['break-word', 'Mot coupé'], ['anywhere', 'N’importe où']] }]} values={values} onChange={change} mode={mode} />
      <Group title="Fonds, bordures et ombres" fields={[{ property: 'backgroundImage', label: 'Dégradé contrôlé', placeholder: 'linear-gradient(...)' }, { property: 'backgroundSize', label: 'Taille du fond' }, { property: 'backgroundPosition', label: 'Position du fond' }, { property: 'backgroundRepeat', label: 'Répétition', options: [['', 'Hérité'], ['no-repeat', 'Aucune'], ['repeat', 'Répéter'], ['repeat-x', 'Horizontale'], ['repeat-y', 'Verticale']] }, { property: 'borderWidth', label: 'Épaisseur de bordure' }, { property: 'borderStyle', label: 'Style de bordure', options: OPTIONS.border }, { property: 'borderColor', label: 'Couleur de bordure', color: true }, { property: 'boxShadow', label: 'Ombre', placeholder: '0 12px 30px rgb(0 0 0 / 12%)' }, { property: 'opacity', label: 'Opacité', placeholder: '0 à 1' }]} values={values} onChange={change} mode={mode} />
      <Group title="Animation et interaction" fields={[{ property: 'cursor', label: 'Curseur', options: [['', 'Hérité'], ['default', 'Défaut'], ['pointer', 'Pointeur'], ['text', 'Texte'], ['not-allowed', 'Interdit']] }, { property: 'transform', label: 'Transformation 2D / 3D', placeholder: 'translateY(-4px)' }, { property: 'transitionProperty', label: 'Propriétés de transition', placeholder: 'color, transform' }, { property: 'transitionDuration', label: 'Durée de transition', placeholder: '180ms' }, { property: 'transitionTimingFunction', label: 'Courbe', options: [['', 'Hérité'], ['ease', 'Ease'], ['ease-out', 'Ease out'], ['ease-in-out', 'Ease in out'], ['linear', 'Linéaire']] }, { property: 'animationName', label: 'Animation prédéfinie', options: [['', 'Hérité'], ['none', 'Aucune'], ['woob-fade', 'Fondu'], ['woob-rise', 'Montée']] }, { property: 'animationDuration', label: 'Durée de l’animation' }, { property: 'animationDelay', label: 'Délai de l’animation' }]} values={values} onChange={change} mode={mode} />
      <section className="inspector-section reusable-styles"><h3>Styles réutilisables</h3><label>Préset du bloc<select value={node.styleId ?? ''} onChange={(event) => actions.onAssign(event.target.value)}><option value="">Aucun</option>{presets.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}</select></label><div className="style-actions"><button type="button" className="button ghost small" onClick={actions.onCopy}>Copier le style</button><button type="button" className="button ghost small" onClick={actions.onPaste} disabled={!actions.canPaste}>Coller</button><button type="button" className="button ghost small" onClick={actions.onReset}>Tout réinitialiser</button></div><label>Nom du nouveau style<input value={presetName} maxLength={80} onChange={(event) => setPresetName(event.target.value)} placeholder="Ex. Bouton arrondi de marque" /></label><button type="button" className="button secondary small" disabled={!presetName.trim()} onClick={() => { actions.onSavePreset(presetName.trim()); setPresetName(''); }}>Enregistrer comme style réutilisable</button><button type="button" className="button ghost small" disabled={!node.styleId} onClick={actions.onApplyToType}>Appliquer le préset aux blocs « {node.type} »</button><p className="field-hint">L’application par type change uniquement la référence du préset : les exceptions locales des autres blocs sont conservées.</p></section>
    </>}
    {mode === 'expert' && <><Group title="Effets et médias experts" fields={[{ property: 'filter', label: 'Filtre', placeholder: 'grayscale(20%)' }, { property: 'backdropFilter', label: 'Flou d’arrière-plan', placeholder: 'blur(12px)' }, { property: 'backgroundBlendMode', label: 'Mode de fusion' }, { property: 'objectFit', label: 'Ajustement média', options: [['', 'Hérité'], ['cover', 'Cover'], ['contain', 'Contain'], ['fill', 'Remplir'], ['none', 'Original']] }, { property: 'objectPosition', label: 'Position du sujet' }, { property: 'transformOrigin', label: 'Origine de transformation' }, { property: 'animationIterationCount', label: 'Itérations' }]} values={values} onChange={change} mode={mode} /><CssVariables node={node} onChange={actions.onVariableChange} /></>}
  </>;
}
