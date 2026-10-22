// @ts-nocheck
import { useEffect, type RefObject } from 'react';

export function useClickOutside(ref: RefObject<HTMLElement>, onOutside: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Mark the key as handled so outer listeners (e.g. selection) don't also react.
      e.preventDefault();
      onOutside();
    };
    document.addEventListener('pointerdown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, onOutside, enabled]);
}
