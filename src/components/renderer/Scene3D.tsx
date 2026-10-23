/* eslint-disable @next/next/no-img-element -- les URL de fallback validées peuvent être externes au allowlist next/image. */
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Scene3DRuntime } from './Scene3DRuntime';

type Props = {
  title: string;
  description: string;
  preset: 'orbital' | 'prism';
  quality: 'low' | 'balanced';
  autoRotate: boolean;
  interactive: boolean;
  fallbackSrc: string;
  fallbackAlt: string;
  webglEnabled: boolean;
  editor: boolean;
  forceReducedMotion: boolean;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'fallback';
type FallbackReason = 'reduced-motion' | 'inactive' | 'unavailable' | null;

export function Scene3D({ title, description, preset, quality, autoRotate, interactive, fallbackSrc, fallbackAlt, webglEnabled, editor, forceReducedMotion }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Scene3DRuntime | null>(null);
  const visibleRef = useRef(false);
  const titleId = useId();
  const [loadState, setLoadState] = useState<LoadState>(forceReducedMotion || !webglEnabled ? 'fallback' : 'idle');
  const [fallbackReason, setFallbackReason] = useState<FallbackReason>(forceReducedMotion ? 'reduced-motion' : webglEnabled ? null : 'inactive');
  const [hasEntered, setHasEntered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const motionReduced = reducedMotion || forceReducedMotion;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!('IntersectionObserver' in window)) {
      const frame = requestAnimationFrame(() => {
        setHasEntered(true);
        setIsVisible(true);
        visibleRef.current = true;
      });
      return () => cancelAnimationFrame(frame);
    }
    const nearObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setHasEntered(true);
        nearObserver.disconnect();
      }
    }, { rootMargin: '240px 0px' });
    const visibleObserver = new IntersectionObserver((entries) => {
      const visible = entries[0]?.isIntersecting ?? false;
      visibleRef.current = visible;
      setIsVisible(visible);
    }, { threshold: 0.05 });
    nearObserver.observe(root);
    visibleObserver.observe(root);
    return () => { nearObserver.disconnect(); visibleObserver.disconnect(); };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!hasEntered || motionReduced || !webglEnabled || !host) {
      setFallbackReason(motionReduced ? 'reduced-motion' : webglEnabled ? null : 'inactive');
      setLoadState(webglEnabled && !motionReduced ? 'idle' : 'fallback');
      return;
    }
    let cancelled = false;
    let runtime: Scene3DRuntime | null = null;
    setFallbackReason(null);
    setLoadState('loading');
    void import('./Scene3DRuntime').then(({ mountScene3D }) => {
      if (cancelled) return;
      try {
        runtime = mountScene3D(host, {
          preset,
          quality,
          autoRotate: autoRotate && !editor,
          interactive,
          onContextLost: () => {
            if (cancelled) return;
            setFallbackReason('unavailable');
            setLoadState('fallback');
          },
        });
        runtimeRef.current = runtime;
        runtime.setActive(visibleRef.current);
        setLoadState('ready');
      } catch {
        setFallbackReason('unavailable');
        setLoadState('fallback');
      }
    }).catch(() => {
      if (cancelled) return;
      setFallbackReason('unavailable');
      setLoadState('fallback');
    });
    return () => {
      cancelled = true;
      runtime?.dispose();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
    // Mount options require a fresh bounded scene; playback has separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEntered, motionReduced, webglEnabled, preset, quality]);

  useEffect(() => {
    if (loadState === 'fallback') {
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    }
  }, [loadState]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.setActive(isVisible && webglEnabled && !motionReduced);
    runtime.setAutoRotate(autoRotate && !editor);
    runtime.setInteractive(interactive);
    runtime.setPaused(paused);
  }, [isVisible, webglEnabled, motionReduced, autoRotate, editor, interactive, paused, loadState]);

  const status = fallbackReason === 'reduced-motion'
    ? 'Version statique · mouvement réduit'
    : fallbackReason === 'inactive'
      ? 'Aperçu statique · 3D désactivée dans ce contexte'
      : fallbackReason === 'unavailable'
        ? 'Version statique · WebGL indisponible'
        : loadState === 'loading'
          ? 'Chargement du moteur 3D…'
          : loadState === 'ready'
            ? editor
              ? 'Scène 3D · rotation automatique suspendue dans l’éditeur'
              : paused
                ? 'Scène 3D · animation en pause'
                : autoRotate ? 'Scène 3D · animation active' : 'Scène 3D · rotation manuelle'
            : 'Version statique · moteur 3D différé';

  const rotate = (direction: -1 | 1) => runtimeRef.current?.rotate(direction);
  return <section ref={rootRef} className="scene3d-shell" aria-labelledby={titleId} data-testid="scene3d" data-scene3d-state={loadState} data-scene3d-fallback-reason={fallbackReason ?? undefined} data-scene3d-paused={paused} data-scene3d-preset={preset}>
    <div className="scene3d-copy">
      <span className="eyebrow">Étude procédurale</span>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      <small>Générée en local · aucun modèle externe</small>
    </div>
    <div className="scene3d-experience">
      <div className="scene3d-stage">
        <div ref={hostRef} className="scene3d-canvas-host" data-testid="scene3d-stage" />
        <div className="scene3d-fallback" data-testid="scene3d-fallback" hidden={loadState === 'ready'}>
          {fallbackSrc ? <img src={fallbackSrc} alt={fallbackAlt} loading="lazy" /> : <svg viewBox="0 0 480 360" role="img" aria-label={fallbackAlt || 'Illustration statique de la scène procédurale.'}>
            <ellipse cx="240" cy="180" rx="150" ry="86" fill="none" stroke="currentColor" strokeWidth="2" opacity=".45" transform="rotate(-18 240 180)" />
            <path d="M240 74 326 124 326 224 240 286 154 224 154 124Z" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="m154 124 86 56 86-56M240 180v106" fill="none" stroke="currentColor" strokeWidth="2" opacity=".7" />
            <circle cx="240" cy="180" r="54" fill="currentColor" opacity=".16" />
          </svg>}
        </div>
      </div>
      <div className="scene3d-toolbar">
        <span role="status">{status}</span>
        {loadState === 'ready' && (interactive || (autoRotate && !editor)) && <div className="scene3d-controls" onClick={(event) => event.stopPropagation()}>
          {interactive && <><button type="button" onClick={() => rotate(-1)} aria-label="Tourner la scène à gauche">← <span>Gauche</span></button>
          <button type="button" onClick={() => rotate(1)} aria-label="Tourner la scène à droite"><span>Droite</span> →</button></>}
          {autoRotate && !editor && <button type="button" onClick={() => setPaused((value) => !value)}>{paused ? 'Reprendre la rotation' : 'Mettre en pause'}</button>}
        </div>}
      </div>
    </div>
  </section>;
}
