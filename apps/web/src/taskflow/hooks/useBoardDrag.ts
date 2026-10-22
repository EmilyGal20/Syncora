// @ts-nocheck
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TaskStatus } from '../types';

export interface DragSession {
  id: string;
  /** Pointer position (viewport coordinates). */
  x: number;
  y: number;
  /** Where inside the card it was grabbed, so the preview doesn't jump. */
  offsetX: number;
  offsetY: number;
  width: number;
  over: TaskStatus | null;
  /** Card the dragged one will be inserted before; null means the end of the column. */
  beforeId: string | null;
}

const MOUSE_THRESHOLD = 5;
const TOUCH_HOLD_MS = 220;
const TOUCH_SLOP = 8;
const EDGE = 56;
const MAX_SCROLL_SPEED = 18;

/**
 * Pointer-event drag and drop for the board. Works with mouse, pen and touch: touch drags
 * start after a short press-and-hold so normal swipes still scroll the page.
 */
export function useBoardDrag(onDrop: (id: string, status: TaskStatus, beforeId: string | null) => void) {
  const [session, setSession] = useState<DragSession | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const columns = useRef(new Map<TaskStatus, HTMLElement>());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const update = (next: DragSession | null) => {
    sessionRef.current = next;
    setSession(next);
  };

  const registerColumn = useCallback(
    (status: TaskStatus) => (el: HTMLElement | null) => {
      if (el) columns.current.set(status, el);
      else columns.current.delete(status);
    },
    [],
  );

  const hitTest = (x: number, y: number, dragId: string): Pick<DragSession, 'over' | 'beforeId'> => {
    for (const [status, el] of columns.current) {
      const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top - 40 || y > r.bottom + 40) continue;
      const cards = [...el.querySelectorAll<HTMLElement>('[data-card-id]')].filter((c) => c.dataset.cardId !== dragId);
      const before = cards.find((c) => {
        const cr = c.getBoundingClientRect();
        return cr.top + cr.height / 2 > y;
      });
      return { over: status, beforeId: before?.dataset.cardId ?? null };
    }
    return { over: null, beforeId: null };
  };

  const start = useCallback((e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0 || sessionRef.current) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    cleanupRef.current?.();

    const card = e.currentTarget;
    // Stop the browser from starting a text selection that would follow the pointer;
    // keep keyboard focus behaviour by focusing the card ourselves.
    if (e.pointerType === 'mouse') {
      e.preventDefault();
      card.focus({ preventScroll: true });
    }
    window.getSelection()?.removeAllRanges();
    const rect = card.getBoundingClientRect();
    const pointerId = e.pointerId;
    const isTouch = e.pointerType === 'touch';
    const startX = e.clientX;
    const startY = e.clientY;
    let lastX = startX;
    let lastY = startY;
    let active = false;
    let frame = 0;

    const activate = () => {
      active = true;
      if (isTouch) navigator.vibrate?.(8);
      document.body.classList.add('select-none', 'cursor-grabbing');
      update({ id, x: lastX, y: lastY, offsetX: startX - rect.left, offsetY: startY - rect.top, width: rect.width, ...hitTest(lastX, lastY, id) });
      frame = requestAnimationFrame(autoScroll);
    };

    // Scroll the board sideways (mobile) and the page vertically while dragging near an edge.
    const autoScroll = () => {
      if (!active) return;
      const speed = (dist: number) => Math.ceil(((EDGE - dist) / EDGE) * MAX_SCROLL_SPEED);
      const scroller = scrollerRef.current;
      if (scroller && scroller.scrollWidth > scroller.clientWidth) {
        const r = scroller.getBoundingClientRect();
        if (lastX < r.left + EDGE) scroller.scrollLeft -= speed(lastX - r.left);
        else if (lastX > r.right - EDGE) scroller.scrollLeft += speed(r.right - lastX);
      }
      if (lastY < EDGE) window.scrollBy(0, -speed(lastY));
      else if (lastY > window.innerHeight - EDGE) window.scrollBy(0, speed(window.innerHeight - lastY));
      const current = sessionRef.current;
      if (current) {
        const hit = hitTest(lastX, lastY, id);
        if (hit.over !== current.over || hit.beforeId !== current.beforeId) update({ ...current, ...hit });
      }
      frame = requestAnimationFrame(autoScroll);
    };

    const holdTimer = isTouch ? window.setTimeout(activate, TOUCH_HOLD_MS) : 0;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (!active) {
        const dist = Math.hypot(lastX - startX, lastY - startY);
        if (isTouch) {
          if (dist > TOUCH_SLOP) cleanup(); // the user is scrolling, not dragging
        } else if (dist > MOUSE_THRESHOLD) {
          activate();
        }
        return;
      }
      ev.preventDefault();
      const current = sessionRef.current;
      if (current) update({ ...current, x: lastX, y: lastY, ...hitTest(lastX, lastY, id) });
    };

    const swallowNextClick = () => {
      const stop = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', stop, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const current = sessionRef.current;
      if (active) {
        swallowNextClick();
        if (current?.over) onDropRef.current(current.id, current.over, current.beforeId);
      }
      cleanup();
    };

    const onCancel = (ev: PointerEvent) => ev.pointerId === pointerId && cleanup();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && active) {
        ev.preventDefault();
        cleanup();
      }
    };
    // Once a touch drag is active, stop the browser from scrolling or showing callouts.
    const onTouchMove = (ev: TouchEvent) => active && ev.cancelable && ev.preventDefault();
    const onContextMenu = (ev: Event) => isTouch && ev.preventDefault();

    function cleanup() {
      window.clearTimeout(holdTimer);
      cancelAnimationFrame(frame);
      active = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('touchmove', onTouchMove);
      card.removeEventListener('contextmenu', onContextMenu);
      document.body.classList.remove('select-none', 'cursor-grabbing');
      cleanupRef.current = null;
      if (sessionRef.current) update(null);
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    card.addEventListener('contextmenu', onContextMenu);
    cleanupRef.current = cleanup;
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return { session, start, registerColumn, scrollerRef };
}
