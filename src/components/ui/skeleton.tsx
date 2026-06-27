import { cn } from "@/utils/cn";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width in Tailwind class or percentage */
  width?: string;
}

/**
 * Skeleton loading placeholder.
 * Use to indicate content is loading.
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "skeleton-shimmer animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  );
}

/** Pre-composed skeleton patterns */
function SkeletonText({ lines = 3 }: { lines?: number }) {
  const lineKeys = Array.from({ length: lines }, (_, i) => `line-${i}`);
  return (
    <div className="space-y-2" aria-hidden="true">
      {lineKeys.map((key, i) => (
        <Skeleton
          key={key}
          className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-6" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  const rowKeys = Array.from({ length: rows }, (_, i) => `row-${i}`);
  const colKeys = Array.from({ length: cols }, (_, i) => `col-${i}`);

  return (
    <div className="w-full" aria-hidden="true">
      {/* Header */}
      <div className="mb-3 flex gap-4 border-b pb-3">
        {colKeys.map((key) => (
          <Skeleton key={`header-${key}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {rowKeys.map((rowKey) => (
        <div key={rowKey} className="flex gap-4 border-b py-3 last:border-0">
          {colKeys.map((colKey) => (
            <Skeleton key={`${rowKey}-${colKey}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable };
