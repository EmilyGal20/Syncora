// @ts-nocheck
import { Fragment, useMemo } from 'react';
import { parseQuery } from '../../lib/tasks';

/** Renders `text` with every plain search word wrapped in <mark>. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    const words = parseQuery(query).words.filter((w) => w.length > 0);
    if (!words.length) return null;
    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return text.split(new RegExp(`(${escaped.join('|')})`, 'gi'));
  }, [text, query]);

  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[3px] bg-amber-200/70 px-px text-inherit dark:bg-amber-400/25">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
