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
    const onAnimationEnd = (event: AnimationEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-surface-reveal]')) return;
      // Do not retain a zero transform: it would still trap fixed descendants such as dialogs.
      event.target.dataset.surfaceState = 'entered';
    };
    container.addEventListener('animationend', onAnimationEnd);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target as HTMLElement;
        reveal(target);
        observer.unobserve(target);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    targets.forEach((target) => { target.dataset.surfaceState = 'pending'; observer.observe(target); });
    const onPreferenceChange = () => {
      if (!media.matches) return;
      targets.forEach(reveal);
      observer.disconnect();
      container.removeEventListener('animationend', onAnimationEnd);
    };
    media.addEventListener('change', onPreferenceChange);
    return () => {
      observer.disconnect();
      container.removeEventListener('animationend', onAnimationEnd);
      media.removeEventListener('change', onPreferenceChange);
      targets.forEach(reveal);
    };
  }, [motionKey]);

  useEffect(() => {
    if (!scrollHeader) return;
    const header = root.current?.querySelector<HTMLElement>('.marketing-header');
    if (!header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = Math.max(0, window.scrollY);
      const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      header.classList.toggle('is-scrolled', top > 32);
      header.style.setProperty('--surface-progress', Math.min(1, top / available).toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      header.classList.remove('is-scrolled');
      header.style.removeProperty('--surface-progress');
    };
  }, [scrollHeader]);

  return <div className="surface-motion-root" ref={root}>{children}</div>;
}
