// @ts-nocheck
import { useUI } from '../../store/UIContext';
import { Modal } from '../ui/Modal';

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['N'], label: 'New task' },
  { keys: ['Shift', 'P'], label: 'New project' },
  { keys: ['Ctrl', 'K'], label: 'Search & commands' },
  { keys: ['/'], label: 'Search & commands' },
  { keys: ['Shift', 'D'], label: 'Toggle dark mode' },
  { keys: ['['], label: 'Collapse or expand sidebar' },
  { keys: ['G', 'D'], label: 'Go to Dashboard' },
  { keys: ['G', 'T'], label: 'Go to My Tasks' },
  { keys: ['G', 'I'], label: 'Go to AI Planner' },
  { keys: ['G', 'B'], label: 'Go to Board' },
  { keys: ['G', 'C'], label: 'Go to Calendar' },
  { keys: ['G', 'P'], label: 'Go to Projects' },
  { keys: ['G', 'A'], label: 'Go to Analytics' },
  { keys: ['G', 'S'], label: 'Go to Settings' },
  { keys: ['J', 'K'], label: 'Next / previous task in a list' },
  { keys: ['X'], label: 'Select focused task' },
  { keys: ['E'], label: 'Edit focused task' },
  { keys: ['Alt', '←→↑↓'], label: 'Move focused board card' },
  { keys: ['Ctrl', 'Enter'], label: 'Save task form' },
  { keys: ['Esc'], label: 'Close dialog or panel' },
  { keys: ['?'], label: 'Show this help' },
];

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useUI();
  return (
    <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="Keyboard shortcuts" description="Move faster without leaving the keyboard.">
      <ul className="grid gap-x-8 pb-3 sm:grid-cols-2">
        {SHORTCUTS.map((s) => (
          <li key={s.label + s.keys.join()} className="flex items-center justify-between border-b border-slate-100 py-2.5 text-sm dark:border-white/[0.06]">
            <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="flex gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className="kbd">
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
