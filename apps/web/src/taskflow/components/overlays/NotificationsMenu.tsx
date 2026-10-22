// @ts-nocheck
import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, BellOff, CheckCheck, CheckCircle2, Clock, Info, Trash2 } from 'lucide-react';
import type { NotificationKind } from '../../types';
import { relativeTime } from '../../lib/date';
import { cn } from '../../lib/utils';
import { useData } from '../../store/DataContext';
import { useUI } from '../../store/UIContext';
import { useClickOutside } from '../../hooks/useClickOutside';
import { EmptyState } from '../ui/EmptyState';

const KIND_STYLES: Record<NotificationKind, { icon: typeof Bell; className: string }> = {
  info: { icon: Info, className: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300' },
  success: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' },
  warning: { icon: Clock, className: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
  danger: { icon: AlertTriangle, className: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' },
};

export function NotificationsMenu() {
  const { notifications, tasks, markNotificationRead, markAllNotificationsRead, clearNotifications } = useData();
  const { now, openTaskDetail } = useUI();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-icon relative"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#f6f6fa] dark:ring-ink-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-3 top-16 z-40 origin-top-right overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[380px] dark:border-white/10 dark:bg-ink-800"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/[0.06]">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</h2>
                <p className="text-xs text-slate-500">{unread ? `${unread} unread` : 'You are all caught up'}</p>
              </div>
              <div className="flex gap-1">
                <button className="btn-icon h-8 w-8" title="Mark all as read" aria-label="Mark all as read" onClick={markAllNotificationsRead} disabled={!unread}>
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button className="btn-icon h-8 w-8" title="Clear all" aria-label="Clear all notifications" onClick={clearNotifications} disabled={!notifications.length}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-1.5">
              {notifications.length === 0 ? (
                <EmptyState compact icon={BellOff} title="No notifications" description="Deadline reminders and updates will appear here." />
              ) : (
                notifications.map((n) => {
                  const style = KIND_STYLES[n.kind];
                  const taskExists = n.taskId && tasks.some((t) => t.id === n.taskId);
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (taskExists) {
                          openTaskDetail(n.taskId!);
                          setOpen(false);
                        }
                      }}
                      className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    >
                      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', style.className)}>
                        <style.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={cn('text-[13px] font-semibold', n.read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-900 dark:text-white')}>
                            {n.title}
                          </span>
                          {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-label="Unread" />}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">{n.message}</span>
                        <span className="mt-1 block text-[11px] text-slate-400">{relativeTime(n.at, now)}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
