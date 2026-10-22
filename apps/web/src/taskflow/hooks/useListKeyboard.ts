// @ts-nocheck
import { useEffect } from 'react';
import { useUIActions } from '../store/UIContext';
import { isAnyLayerOpen } from './useLayer';
import { isTypingTarget } from '../lib/utils';

/**
 * Linear-style list navigation: J/K move between tasks, X toggles selection,
 * E edits, Enter opens (native on the focused title button).
 */
export function useListKeyboard(enabled = true) {
  const { toggleSelected, openTaskForm } = useUIActions();

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || isAnyLayerOpen()) return;
      const key = e.key.toLowerCase();
      if (!['j', 'k', 'x', 'e'].includes(key)) return;

      const rows = [...document.querySelectorAll<HTMLElement>('main [data-task-row]')];
      if (!rows.length) return;
      const current = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-task-row]');
      const index = current ? rows.indexOf(current) : -1;

      if (key === 'j' || key === 'k') {
        e.preventDefault();
        const next = rows[key === 'j' ? Math.min(rows.length - 1, index + 1) : Math.max(0, index === -1 ? 0 : index - 1)];
        const target = next.querySelector<HTMLElement>('[data-row-focus]');
        target?.focus();
        target?.scrollIntoView({ block: 'nearest' });
      } else if (current) {
        e.preventDefault();
        const id = current.dataset.taskRow!;
        if (key === 'x') toggleSelected(id);
        else openTaskForm({ taskId: id });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, toggleSelected, openTaskForm]);
}
