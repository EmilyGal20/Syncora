// @ts-nocheck
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { cn } from '../../lib/utils';

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

interface MenuProps {
  trigger: (props: { onClick: (e: React.MouseEvent) => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  /** Open upward, e.g. from a toolbar pinned to the bottom of the screen. */
  placement?: 'bottom' | 'top';
}

/** Small dropdown menu for contextual actions (edit, delete, …). */
export function Menu({ trigger, items, align = 'right', placement = 'bottom' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div className="relative" ref={ref}>
      {trigger({
        onClick: (e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: placement === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: placement === 'top' ? 4 : -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.14 }}
            className={cn(
              'absolute z-30 max-h-72 min-w-[170px] overflow-y-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-pop dark:border-white/10 dark:bg-ink-800',
              placement === 'top' ? 'bottom-full mb-2 origin-bottom' : 'mt-1 origin-top-right',
              align === 'right' ? 'right-0' : 'left-0',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                  item.danger
                    ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]',
                )}
              >
                <item.icon className="h-4 w-4 opacity-70" />
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
