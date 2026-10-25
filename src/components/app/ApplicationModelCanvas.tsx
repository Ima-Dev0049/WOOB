'use client';

import { useMemo, useRef } from 'react';
import { applicationFieldTypeLabels } from '@/lib/application/model-editor';
import type { ApplicationObject } from '@/lib/application/model';

export type ApplicationCanvasPoint = { x: number; y: number };

const NODE_WIDTH = 240;
const NODE_HEIGHT = 190;

export function applicationCanvasPointAt(index: number): ApplicationCanvasPoint {
  return { x: 32 + (index % 3) * 292, y: 32 + Math.floor(index / 3) * 238 };
}

export function initialApplicationCanvasPositions(objects: ReadonlyArray<{ key: string }>): Record<string, ApplicationCanvasPoint> {
  return Object.fromEntries(objects.map((object, index) => [object.key, applicationCanvasPointAt(index)]));
}

function relationGeometry(sourceKey: string, targetKey: string, source: ApplicationCanvasPoint, target: ApplicationCanvasPoint) {
  if (sourceKey === targetKey) {
    const x = source.x + NODE_WIDTH;
    const y = source.y + 65;
    return { path: `M ${x} ${y} C ${x + 120} ${y - 45} ${x + 120} ${y + 105} ${x} ${y + 60}`, labelX: x + 82, labelY: y + 28 };
  }
  const sourceY = source.y + NODE_HEIGHT / 2;
  const targetY = target.y + NODE_HEIGHT / 2;
  if (source.x === target.x) {
    const x = source.x + NODE_WIDTH;
    return { path: `M ${x} ${sourceY} C ${x + 120} ${sourceY} ${x + 120} ${targetY} ${x} ${targetY}`, labelX: x + 72, labelY: (sourceY + targetY) / 2 - 8 };
  }
  const forward = source.x < target.x;
  const sourceX = source.x + (forward ? NODE_WIDTH : 0);
  const targetX = target.x + (forward ? 0 : NODE_WIDTH);
  const direction = forward ? 1 : -1;
  const curve = Math.max(60, Math.abs(targetX - sourceX) * 0.45);
  return {
    path: `M ${sourceX} ${sourceY} C ${sourceX + curve * direction} ${sourceY} ${targetX - curve * direction} ${targetY} ${targetX} ${targetY}`,
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2 - 8,
  };
}

export function ApplicationModelCanvas({ objects, originalKeys, positions, selectedKey, relationSource, pending, onSelect, onMove, onAddObject, onAddField, onAddAction, onBeginRelation, onCancelRelation, onResetLayout }: {
  objects: ApplicationObject[];
  originalKeys: ReadonlySet<string>;
  positions: Record<string, ApplicationCanvasPoint>;
  selectedKey: string;
  relationSource: string | null;
  pending: boolean;
  onSelect: (objectKey: string) => void;
  onMove: (objectKey: string, point: ApplicationCanvasPoint) => void;
  onAddObject: () => void;
  onAddField: (objectKey: string) => void;
  onAddAction: (objectKey: string) => void;
  onBeginRelation: (objectKey: string) => void;
  onCancelRelation: () => void;
  onResetLayout: () => void;
}) {
  const dragRef = useRef<{ key: string; pointerId: number; startX: number; startY: number; origin: ApplicationCanvasPoint; moved: boolean } | null>(null);
  const objectsByKey = useMemo(() => new Map(objects.map((object, index) => [object.key, { object, index }])), [objects]);
  const canvasSize = useMemo(() => objects.reduce((size, object, index) => {
    const point = positions[object.key] ?? applicationCanvasPointAt(index);
    return { width: Math.max(size.width, point.x + NODE_WIDTH + 140), height: Math.max(size.height, point.y + NODE_HEIGHT + 50) };
  }, { width: 900, height: 320 }), [objects, positions]);
  const relationSourceLabel = relationSource ? objectsByKey.get(relationSource)?.object.pluralLabel : undefined;

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, objectKey: string, index: number) {
    if (event.button !== 0 || pending) return;
    dragRef.current = { key: objectKey, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: positions[objectKey] ?? applicationCanvasPointAt(index), moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true;
    onMove(drag.key, { x: Math.max(0, Math.round(drag.origin.x + deltaX)), y: Math.max(0, Math.round(drag.origin.y + deltaY)) });
  }

  function finishDrag(event: React.PointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && !drag.moved) onSelect(drag.key);
  }

  function moveWithKeyboard(event: React.KeyboardEvent<HTMLButtonElement>, objectKey: string, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(objectKey);
      return;
    }
    const deltas: Record<string, ApplicationCanvasPoint> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    const delta = deltas[event.key];
    if (!delta || pending) return;
    event.preventDefault();
    const current = positions[objectKey] ?? applicationCanvasPointAt(index);
    const step = event.shiftKey ? 1 : 12;
    onMove(objectKey, { x: Math.max(0, current.x + delta.x * step), y: Math.max(0, current.y + delta.y * step) });
  }

  return <section className="application-model-canvas-panel" aria-labelledby="application-model-canvas-title">
    <header>
      <div><h3 id="application-model-canvas-title">Canvas du modèle</h3><p id="application-model-canvas-help">Glissez les en-têtes ou utilisez les flèches du clavier. Entrée sélectionne un objet. « Relier » puis la cible prépare une relation dans l’inspecteur.</p></div>
      <div className="application-model-canvas-actions"><button type="button" className="button secondary small" disabled={pending} onClick={onAddObject}>Ajouter un objet sur le canvas</button><button type="button" className="button ghost small" disabled={pending} onClick={onResetLayout}>Réorganiser le canvas</button></div>
    </header>
    {relationSource && <p className="application-model-canvas-linking" role="status">Liaison depuis <strong>{relationSourceLabel ?? relationSource}</strong> : activez l’objet cible. <button type="button" className="button ghost small" onClick={onCancelRelation}>Annuler la liaison</button></p>}
    <div className="application-model-canvas-viewport" role="region" aria-label="Canvas des objets et relations" tabIndex={0}>
      <div className="application-model-canvas-surface" style={{ width: canvasSize.width, height: canvasSize.height }}>
        <svg className="application-model-canvas-edges" width={canvasSize.width} height={canvasSize.height} aria-hidden="true">
          <defs><marker id="application-model-canvas-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 z" /></marker></defs>
          {objects.flatMap((object, sourceIndex) => object.fields.filter((field) => field.type === 'relation' && field.targetObject).map((field) => {
            const target = field.targetObject ? objectsByKey.get(field.targetObject) : undefined;
            if (!target) return null;
            const geometry = relationGeometry(object.key, target.object.key, positions[object.key] ?? applicationCanvasPointAt(sourceIndex), positions[target.object.key] ?? applicationCanvasPointAt(target.index));
            return <g key={`${object.key}:${field.key}`}><path d={geometry.path} markerEnd="url(#application-model-canvas-arrow)" /><text x={geometry.labelX} y={geometry.labelY} textAnchor="middle">{field.label}</text></g>;
          }))}
        </svg>
        {objects.map((object, index) => {
          const point = positions[object.key] ?? applicationCanvasPointAt(index);
          const added = !originalKeys.has(object.key);
          return <article key={object.key} data-object-key={object.key} className={`application-model-canvas-node${selectedKey === object.key ? ' selected' : ''}${relationSource === object.key ? ' relation-source' : ''}`} style={{ transform: `translate(${point.x}px, ${point.y}px)` }}>
            <button type="button" className="application-model-canvas-node-header" disabled={pending} aria-describedby="application-model-canvas-help" aria-pressed={selectedKey === object.key} onPointerDown={(event) => startDrag(event, object.key, index)} onPointerMove={moveDrag} onPointerUp={(event) => finishDrag(event)} onPointerCancel={(event) => finishDrag(event, true)} onKeyDown={(event) => moveWithKeyboard(event, object.key, index)}>
              <span><strong>{object.pluralLabel}</strong><code>{object.key}</code></span>{added ? <span className="application-model-new-badge">Nouveau</span> : <span aria-hidden="true">⠿</span>}
            </button>
            <ul aria-label={`Champs et transitions de ${object.pluralLabel}`} tabIndex={0}>
              {object.fields.map((field) => <li key={field.key}><span>{field.label}</span><code>{field.type === 'relation' ? `→ ${field.targetObject}` : applicationFieldTypeLabels[field.type]}</code></li>)}
              {object.actions.map((action) => <li className="application-model-canvas-action" key={`action:${action.key}`}><span>↳ {action.label}</span><code>{action.from.join(', ')} → {action.to}</code></li>)}
            </ul>
            <footer><button type="button" className="button ghost small" disabled={pending} aria-label={`Ajouter un champ à ${object.pluralLabel} sur le canvas`} onClick={() => onAddField(object.key)}>+ Champ</button><button type="button" className="button secondary small" disabled={pending} aria-label={`Relier ${object.pluralLabel} sur le canvas`} onClick={() => onBeginRelation(object.key)}>Relier</button>{object.statusField && <button type="button" className="button ghost small" disabled={pending} aria-label={`Ajouter une transition à ${object.pluralLabel} sur le canvas`} onClick={() => onAddAction(object.key)}>+ Transition</button>}</footer>
          </article>;
        })}
      </div>
    </div>
    <p className="application-model-canvas-note">La position des cartes est locale à ce brouillon visuel et n’est pas enregistrée dans le schéma. La liste d’aperçu conserve une alternative linéaire à ce canvas.</p>
  </section>;
}
