// @ts-nocheck
import { cn } from '../../lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-[shimmer_1.6s_linear_infinite] rounded-lg bg-[length:200%_100%]',
        'bg-[linear-gradient(90deg,theme(colors.slate.100)_0%,theme(colors.slate.50)_40%,theme(colors.slate.100)_80%)]',
        'dark:bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.08)_40%,rgba(255,255,255,0.04)_80%)]',
        className,
      )}
    />
  );
}

/** Placeholder shown while a page's code chunk loads. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card space-y-3 p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card space-y-4 p-6 xl:col-span-2">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
        <div className="card space-y-4 p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mx-auto h-28 w-28 rounded-full" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
