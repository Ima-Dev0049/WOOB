'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

/** A short native route entrance. SSR stays visible and no transform is retained afterward. */
export function RouteMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation: Animation | undefined;
    const finish = () => { container.dataset.routeState = 'entered'; };
    const start = () => {
      animation?.cancel();
      finish();
      if (media.matches || typeof container.animate !== 'function') return;
      container.dataset.routeState = 'animating';
      animation = container.animate([
        { opacity: 0, translate: '0 10px' },
        { opacity: 1, translate: '0 0' },
      ], { duration: 380, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'none' });
      animation.onfinish = finish;
    };
    const onPreferenceChange = () => {
      if (!media.matches) return;
      animation?.cancel();
      finish();
    };
    start();
    media.addEventListener('change', onPreferenceChange);
    return () => {
      animation?.cancel();
      media.removeEventListener('change', onPreferenceChange);
      finish();
    };
  }, [pathname]);

  return <div className="experience-route" ref={root} data-route-motion="native">{children}</div>;
}
