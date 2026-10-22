// @ts-nocheck
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  color?: string;
  size?: 'sm' | 'md';
}

/** Round, animated completion checkbox tinted by task priority. */
export function Checkbox({ checked, onChange, label, color = '#8b5cf6', size = 'md' }: CheckboxProps) {
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-[20px] w-[20px]';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        'group/check relative grid shrink-0 place-items-center rounded-full border-[1.5px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-900',
        dim,
      )}
      style={{
        borderColor: color,
        backgroundColor: checked ? color : 'transparent',
      }}
    >
      <span
        className="absolute inset-0 rounded-full opacity-0 transition-opacity group-hover/check:opacity-100"
        style={{ backgroundColor: checked ? 'transparent' : `${color}1f` }}
      />
      <svg viewBox="0 0 16 16" className={cn('relative', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} fill="none">
        <motion.path
          d="M3.5 8.5l3 3 6-7"
          stroke={checked ? '#fff' : color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </svg>
    </button>
  );
}
