'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

function reveal(target: HTMLElement): void { target.dataset.surfaceState = 'visible'; }

/**
 * Native, one-shot surface entrances with an optional marketing scroll header.
 * SSR content stays visible without JavaScript and no perpetual animation loop is created.
 */
export function MotionSurface({ children, scrollHeader = false, motionKey = 'surface' }: { children: ReactNode; scrollHeader?: boolean; motionKey?: string }) {
  const root = useRef<HTMLDivElement>(null);

  // Mark targets before the hydration paint; SSR HTML itself never starts hidden.
  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-surface-reveal]'));
    if (!targets.length) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches || !('IntersectionObserver' in window)) {
      targets.forEach(reveal);
      return;
    }
    const completionTimers = new Map<HTMLElement, number>();
    const complete = (target: HTMLElement) => {
      const timer = completionTimers.get(target);
      if (timer) window.clearTimeout(timer);
      completionTimers.delete(target);
      // Do not retain a zero transform: it would still trap fixed descendants such as dialogs.
      if (target.dataset.surfaceState === 'visible') target.dataset.surfaceState = 'entered';
    };
    const revealAndSchedule = (target: HTMLElement) => {
      reveal(target);
      // Longest current sequence: 820ms + 350ms delay. This is a fallback, not a loop.
      completionTimers.set(target, window.setTimeout(() => complete(target), 1500));
    };
    const onAnimationEnd = (event: AnimationEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-surface-reveal]')) return;
      complete(event.target);
    };
    container.addEventListener('animationend', onAnimationEnd);
    container.addEventListener('animationcancel', onAnimationEnd);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target as HTMLElement;
        revealAndSchedule(target);
        observer.unobserve(target);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    targets.forEach((target) => { target.dataset.surfaceState = 'pending'; observer.observe(target); });
    const onPreferenceChange = () => {
      if (!media.matches) return;
      completionTimers.forEach((timer) => window.clearTimeout(timer));
      completionTimers.clear();
      targets.forEach(reveal);
      observer.disconnect();
      container.removeEventListener('animationend', onAnimationEnd);
      container.removeEventListener('animationcancel', onAnimationEnd);
    };
    media.addEventListener('change', onPreferenceChange);
    return () => {
      observer.disconnect();
      container.removeEventListener('animationend', onAnimationEnd);
      container.removeEventListener('animationcancel', onAnimationEnd);
      media.removeEventListener('change', onPreferenceChange);
      completionTimers.forEach((timer) => window.clearTimeout(timer));
      completionTimers.clear();
      targets.forEach(reveal);
    };
  }, [motionKey]);

  useEffect(() => {
    if (!scrollHeader) return;
    const container = root.current;
    if (!container) return;
    const header = container.querySelector<HTMLElement>('.marketing-header');
    const scene = container.querySelector<HTMLElement>('[data-surface-scene]');
    if (!header && !scene) return;
    const sceneMedia = window.matchMedia('(min-width: 761px) and (prefers-reduced-motion: no-preference)');
    let frame = 0;
    const update = () => {
      frame = 0;
      let sceneProgress = 0;
      if (scene) {
        const bounds = scene.getBoundingClientRect();
        scene.dataset.surfaceActive = bounds.bottom > 0 && bounds.top < window.innerHeight ? 'true' : 'false';
        if (sceneMedia.matches) {
          const travel = Math.max(1, Math.min(bounds.height, window.innerHeight));
          sceneProgress = Math.min(1, Math.max(0, -bounds.top / travel));
        }
      }
      const top = Math.max(0, window.scrollY);
      if (header) {
        const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        header.classList.toggle('is-scrolled', top > 32);
        header.style.setProperty('--surface-progress', Math.min(1, top / available).toFixed(4));
      }
      if (scene) scene.style.setProperty('--surface-scene-progress', sceneProgress.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    sceneMedia.addEventListener('change', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      sceneMedia.removeEventListener('change', schedule);
      if (header) {
        header.classList.remove('is-scrolled');
        header.style.removeProperty('--surface-progress');
      }
      if (scene) {
        scene.style.removeProperty('--surface-scene-progress');
        delete scene.dataset.surfaceActive;
      }
    };
  }, [scrollHeader, motionKey]);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-surface-tilt]'));
    if (!targets.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const cleanups: (() => void)[] = [];
    for (const target of targets) {
      let frame = 0;
      let rotateX = 0;
      let rotateY = 0;
      const apply = () => {
        frame = 0;
        target.style.setProperty('--surface-tilt-x', `${rotateX.toFixed(2)}deg`);
        target.style.setProperty('--surface-tilt-y', `${rotateY.toFixed(2)}deg`);
      };
      const reset = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        delete target.dataset.surfaceTiltActive;
        target.style.setProperty('--surface-tilt-x', '0deg');
        target.style.setProperty('--surface-tilt-y', '0deg');
      };
      const onPointerMove = (event: PointerEvent) => {
        if (reduced.matches || !finePointer.matches || event.pointerType === 'touch') { reset(); return; }
        const rect = target.getBoundingClientRect();
        const x = Math.min(1, Math.max(-1, ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2));
        const y = Math.min(1, Math.max(-1, ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2));
        rotateX = -y * 1.4;
        rotateY = x * 1.8;
        target.dataset.surfaceTiltActive = 'true';
        if (!frame) frame = requestAnimationFrame(apply);
      };
      target.addEventListener('pointermove', onPointerMove, { passive: true });
      target.addEventListener('pointerleave', reset);
      target.addEventListener('pointercancel', reset);
      cleanups.push(() => {
        reset();
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerleave', reset);
        target.removeEventListener('pointercancel', reset);
      });
    }
    const onPreferenceChange = () => { if (reduced.matches) cleanups.forEach((cleanup) => cleanup()); };
    reduced.addEventListener('change', onPreferenceChange);
    return () => {
      reduced.removeEventListener('change', onPreferenceChange);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [motionKey]);

  return <div className="surface-motion-root" ref={root}>{children}</div>;
}
