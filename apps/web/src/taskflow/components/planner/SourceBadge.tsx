// @ts-nocheck
import { FlaskConical, Sparkles } from 'lucide-react';
import { summarizeWarnings, type Plan } from '../../lib/ai';
import { parseISODate } from '../../lib/date';

const formatDeadline = (iso: string) =>
  parseISODate(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** Always tells the user where the suggestions came from. */
export function SourceBadge({ plan }: { plan: Plan }) {
  const note = summarizeWarnings(plan.warnings);
  return (
    <div className="space-y-1.5">
      {plan.source === 'demo' ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            Demo plan · not AI-generated
          </span>
          <p className="text-xs muted">
            These suggestions come from TaskFlow’s built-in template generator, not an AI model. Review and edit them before adding.
          </p>
        </>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/25">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          AI-generated · review before adding
        </span>
      )}
      {plan.deadlineSource !== 'explicit' && (
        <p className="text-xs muted">
          Deadline: {formatDeadline(plan.effectiveDeadline)} ({plan.deadlineSource === 'parsed' ? 'from your goal' : 'default: 1 week'})
        </p>
      )}
      {note && <p className="text-xs muted">{note.charAt(0).toUpperCase() + note.slice(1)}.</p>}
    </div>
  );
}
