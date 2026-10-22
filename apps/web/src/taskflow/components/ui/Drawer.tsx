// @ts-nocheck
import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLayer } from '../../hooks/useLayer';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, label, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useLayer(open, onClose, panelRef);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px] dark:bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%', transition: { duration: 0.2, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-slate-200/80 bg-white shadow-pop outline-none dark:border-white/10 dark:bg-ink-900"
          >
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
