'use client';

import { useEffect, useRef } from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true' && element.getAttribute('aria-disabled') !== 'true');
}

/** Keeps keyboard focus inside a modal and returns it to the invoking control. */
export function useModalFocus<T extends HTMLElement>(active: boolean, onClose: () => void) {
  const containerRef = useRef<T | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      if (!container.contains(document.activeElement)) {
        const preferred = container.querySelector<HTMLElement>('[data-modal-autofocus]');
        (preferred || focusableElements(container)[0] || container).focus();
      }
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusableElements(container);
      if (!elements.length) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = elements[0]!;
      const last = elements[elements.length - 1]!;
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active]);

  return containerRef;
}
