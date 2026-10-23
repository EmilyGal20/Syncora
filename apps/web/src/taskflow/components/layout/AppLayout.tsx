// @ts-nocheck
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useUI } from '../../store/UIContext';
import { useLayer } from '../../hooks/useLayer';
import { SidebarContent } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout({ children, pageKey }: { children: ReactNode; pageKey: string }) {
  const { embedded, mobileNavOpen, setMobileNavOpen, openTaskForm, route, selectedIds, sidebarCollapsed } = useUI();

  // Expose the sidebar width as a CSS variable so fixed elements (like the bulk bar) can follow it.
  useEffect(() => {
    if (embedded) return;
    document.documentElement.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    return () => document.documentElement.classList.remove('sidebar-collapsed');
  }, [embedded, sidebarCollapsed]);
  const drawerRef = useRef<HTMLDivElement>(null);
  useLayer(mobileNavOpen, () => setMobileNavOpen(false), drawerRef);

  return (
    <div className="min-h-full">
      {!embedded && (
      <aside
        aria-label="Sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] border-r border-slate-200/70 bg-white/70 backdrop-blur-xl transition-[width] duration-200 ease-out lg:block dark:border-white/[0.06] dark:bg-ink-900/60"
      >
        <SidebarContent />
      </aside>
      )}

      {!embedded && createPortal(
        <AnimatePresence>
          {mobileNavOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <motion.div
                className="absolute inset-0 bg-slate-900/30 dark:bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileNavOpen(false)}
              />
              <motion.div
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-pop dark:bg-ink-900"
              >
                <button className="btn-icon absolute right-3 top-3.5 z-10" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
                <SidebarContent variant="mobile" />
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <div className={embedded ? '' : 'transition-[padding] duration-200 ease-out lg:pl-[var(--sidebar-w)]'}>
        <Topbar />
        <main className="mx-auto max-w-[1400px] px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6 lg:max-w-[1680px] lg:px-8 lg:pb-10 lg:pt-8 xl:max-w-[1920px]">
          <motion.div key={pageKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
            {children}
          </motion.div>
        </main>
      </div>

      {/* The planner's save bar sits at the bottom on phones, so the quick-add button stays out of its way. */}
      {selectedIds.length === 0 && route.name !== 'planner' && (
      <button
        onClick={() => openTaskForm(route.name === 'project' ? { defaults: { projectId: route.id } } : undefined)}
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-20 grid h-14 w-14 place-items-center rounded-2xl bg-violet-600 text-white shadow-glow transition active:scale-95 sm:hidden"
        aria-label="Quick add task"
      >
        <Plus className="h-6 w-6" />
      </button>
      )}
    </div>
  );
}
