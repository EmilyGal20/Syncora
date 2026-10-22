// @ts-nocheck
import { useEffect, useRef } from 'react';
import type { AppNotification } from '../types';
import { useData } from '../store/DataContext';
import { useUI, type Route } from '../store/UIContext';
import { formatDueLabel, formatTime, toISODate } from '../lib/date';
import { isDueOn, isOverdue } from '../lib/tasks';
import { getOverview } from '../lib/stats';
import { isTypingTarget } from '../lib/utils';
import { isAnyLayerOpen } from './useLayer';

/** Raises in-app notifications for overdue tasks, tasks due today, and reaching the daily goal. */
export function useDeadlineNotifications() {
  const { tasks, settings, addNotifications } = useData();
  const { now } = useUI();

  useEffect(() => {
    const items: Omit<AppNotification, 'id' | 'at' | 'read'>[] = [];
    if (settings.deadlineAlerts) {
      for (const t of tasks) {
        if (t.status === 'done' || !t.dueDate) continue;
        if (isOverdue(t, now)) {
          items.push({
            key: `overdue:${t.id}:${t.dueDate}:${t.dueTime ?? ''}`,
            kind: 'danger',
            title: 'Task overdue',
            message: `“${t.title}” was due ${formatDueLabel(t.dueDate, t.dueTime, now).replace(/^(Today|Yesterday)/, (w) => w.toLowerCase())}.`,
            taskId: t.id,
          });
        } else if (isDueOn(t, now)) {
          items.push({
            key: `due-today:${t.id}:${t.dueDate}`,
            kind: 'warning',
            title: 'Due today',
            message: `“${t.title}” is due ${t.dueTime ? `at ${formatTime(t.dueTime)}` : 'today'}.`,
            taskId: t.id,
          });
        }
      }
    }
    const { completedToday } = getOverview(tasks, now, settings.dailyGoal);
    if (completedToday >= settings.dailyGoal) {
      items.push({
        key: `goal:${toISODate(now)}`,
        kind: 'success',
        title: 'Daily goal reached',
        message: `You completed ${completedToday} tasks today. Great work!`,
      });
    }
    addNotifications(items);
  }, [tasks, now, settings.deadlineAlerts, settings.dailyGoal, addNotifications]);
}

const GO_TO: Record<string, Route> = {
  d: { name: 'dashboard' },
  t: { name: 'tasks' },
  i: { name: 'planner' },
  b: { name: 'board' },
  c: { name: 'calendar' },
  p: { name: 'projects' },
  a: { name: 'analytics' },
  s: { name: 'settings' },
};

export function useKeyboardShortcuts() {
  const ui = useUI();
  const { updateSettings } = useData();
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const pendingG = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const u = uiRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (u.paletteOpen) u.setPaletteOpen(false);
        else if (!isAnyLayerOpen()) u.setPaletteOpen(true);
        return;
      }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target) || isAnyLayerOpen()) return;

      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const route = GO_TO[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          u.navigate(route);
        }
        return;
      }

      const key = e.shiftKey && e.key.length === 1 ? e.key.toUpperCase() : e.key;
      switch (key) {
        case 'g':
          pendingG.current = window.setTimeout(() => (pendingG.current = null), 1200);
          break;
        case 'n':
        case 'c':
          e.preventDefault();
          u.openTaskForm(u.route.name === 'project' ? { defaults: { projectId: u.route.id } } : undefined);
          break;
        case 'P':
          e.preventDefault();
          u.openProjectForm();
          break;
        case '/':
          e.preventDefault();
          u.setPaletteOpen(true);
          break;
        case '?':
          e.preventDefault();
          u.setShortcutsOpen(true);
          break;
        case '[':
          e.preventDefault();
          u.toggleSidebar();
          break;
        case 'D':
          e.preventDefault();
          updateSettings({ theme: u.isDark ? 'light' : 'dark' });
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [updateSettings]);
}
