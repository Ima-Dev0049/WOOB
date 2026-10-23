'use client';

import { useEffect, useRef, type ReactNode } from 'react';

function reveal(target: HTMLElement): void { target.dataset.motionState = 'visible'; }

/** Native, one-shot in-view entrances. No animation library and no hidden SSR content. */
export function CreativeMotion({ children, enabled, reduceMotion, motionKey }: { children: ReactNode; enabled: boolean; reduceMotion: boolean; motionKey: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    if (!container || !enabled) return;
    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-motion-preset]'));
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
  return <div className="creative-motion-root" ref={root} data-motion-key={motionKey}>{children}</div>;
}
