'use client';

import { useEffect, useRef, type ReactNode } from 'react';

function reveal(target: HTMLElement): void { target.dataset.motionState = 'visible'; }
function clearScroll(target: HTMLElement): void {
  delete target.dataset.motionProgress;
  for (const property of ['--woob-motion-shift', '--woob-motion-alpha', '--woob-motion-clip', '--woob-motion-scale']) target.style.removeProperty(property);
}

/** Native one-shot entrances and bounded scroll progress. SSR content never starts hidden. */
export function CreativeMotion({ children, enabled, reduceMotion, motionKey }: { children: ReactNode; enabled: boolean; reduceMotion: boolean; motionKey: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = root.current;
    if (!container || !enabled) return;
    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-motion-preset]:not([data-motion-trigger="scroll"])'));
    if (!targets.length) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion || media.matches || !('IntersectionObserver' in window)) {
      targets.forEach(reveal);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target as HTMLElement;
        reveal(target);
        observer.unobserve(target);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((target) => { target.dataset.motionState = 'pending'; observer.observe(target); });
    const onPreferenceChange = () => {
      if (!media.matches) return;
      targets.forEach(reveal);
      observer.disconnect();
    };
    media.addEventListener('change', onPreferenceChange);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', onPreferenceChange);
      targets.forEach(reveal);
    };
  }, [enabled, reduceMotion, motionKey]);

  useEffect(() => {
    const container = root.current;
    if (!container || !enabled) return;
    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-motion-trigger="scroll"]'));
    if (!targets.length) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion || media.matches) {
      targets.forEach((target) => { reveal(target); clearScroll(target); });
      return;
    }
    let frame = 0;
    let stopped = false;
    const update = () => {
      frame = 0;
      if (stopped) return;
      const viewportHeight = Math.max(1, window.innerHeight);
      for (const target of targets) {
        const rect = target.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (viewportHeight - rect.top) / (viewportHeight + Math.max(1, rect.height))));
        const distance = Math.min(96, Math.max(0, Number(target.dataset.motionDistance) || 0));
        const alpha = Math.min(1, progress * 2);
        const shift = target.dataset.motionPreset === 'parallax' ? (0.5 - progress) * distance * 2 : (1 - progress) * distance;
        target.dataset.motionState = 'tracking';
        target.dataset.motionProgress = progress.toFixed(3);
        target.style.setProperty('--woob-motion-shift', `${shift.toFixed(2)}px`);
        target.style.setProperty('--woob-motion-alpha', alpha.toFixed(3));
        target.style.setProperty('--woob-motion-clip', `${((1 - alpha) * 18).toFixed(2)}%`);
        target.style.setProperty('--woob-motion-scale', (0.975 + alpha * 0.025).toFixed(4));
      }
    };
    const schedule = () => {
      if (!stopped && !frame) frame = requestAnimationFrame(update);
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
    const onPreferenceChange = () => {
      if (!media.matches) return;
      stop();
      targets.forEach((target) => { reveal(target); clearScroll(target); });
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    media.addEventListener('change', onPreferenceChange);
    return () => {
      stop();
      media.removeEventListener('change', onPreferenceChange);
      targets.forEach((target) => { reveal(target); clearScroll(target); });
    };
  }, [enabled, reduceMotion, motionKey]);

  return <div className="creative-motion-root" ref={root} data-motion-key={motionKey}>{children}</div>;
}
