// @ts-nocheck
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLayer } from '../../hooks/useLayer';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

export function Modal({ open, onClose, title, description, children, footer, size = 'md', icon }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useLayer(open, onClose, panelRef);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn(
              'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200/80 bg-white shadow-pop outline-none sm:rounded-2xl dark:border-white/10 dark:bg-ink-900',
              SIZES[size],
            )}
          >
            <div className="flex items-start gap-3 px-6 pb-2 pt-5">
              {icon}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
              </div>
              <button onClick={onClose} className="btn-icon -mr-2 -mt-1 h-8 w-8" aria-label="Close dialog">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children ? <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div> : <div className="h-3" />}
            {footer && (
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-end dark:border-white/[0.06] dark:bg-white/[0.02]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
