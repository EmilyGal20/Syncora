// @ts-nocheck
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type Tone = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  title: string;
  description?: string;
  tone?: Tone;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((opts: ToastOptions) => void) | null>(null);

const ICONS: Record<Tone, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 text-rose-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  info: <Info className="h-5 w-5 text-violet-500" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { ...opts, id }]);
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 6000 : 3500));
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] max-sm:[.has-save-bar_&]:bottom-24 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end"
        >
          <AnimatePresence initial={false}>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                role="status"
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-pop backdrop-blur dark:border-white/10 dark:bg-ink-800/95"
              >
                <span className="mt-0.5 shrink-0">{ICONS[t.tone ?? 'success']}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{t.description}</p>}
                </div>
                {t.action && (
                  <button
                    className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-violet-600 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(t.id)}
                  className={cn('shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
