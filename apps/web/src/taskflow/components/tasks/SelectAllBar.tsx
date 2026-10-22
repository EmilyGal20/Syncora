// @ts-nocheck
import { useEffect, useRef } from 'react';
import { useUI } from '../../store/UIContext';

/** "Select all" control for the visible tasks; hints at bulk actions when nothing is selected. */
export function SelectAllBar({ ids }: { ids: string[] }) {
  const { selectedIds, setSelectedIds, clearSelection } = useUI();
  const ref = useRef<HTMLInputElement>(null);
  const selectedVisible = ids.filter((id) => selectedIds.includes(id)).length;
  const all = ids.length > 0 && selectedVisible === ids.length;
  const some = selectedVisible > 0 && !all;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);

  if (ids.length === 0) return null;
  return (
    <div className="flex items-center gap-3 px-3 pb-1 pt-1 text-xs text-slate-500 dark:text-slate-400">
      <label className="flex cursor-pointer items-center gap-2 font-medium hover:text-slate-700 dark:hover:text-slate-200">
        <input
          ref={ref}
          type="checkbox"
          checked={all}
          onChange={() => (all ? clearSelection() : setSelectedIds(ids))}
          className="h-4 w-4 cursor-pointer rounded accent-violet-600"
        />
        {selectedVisible > 0 ? `${selectedVisible} of ${ids.length} selected` : `Select all (${ids.length})`}
      </label>
      {selectedVisible === 0 && <span className="hidden text-slate-400 sm:inline">· Select tasks to edit them in bulk</span>}
    </div>
  );
}
