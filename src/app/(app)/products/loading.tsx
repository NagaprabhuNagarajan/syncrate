import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  const tileKeys = ["a", "b", "c", "d"];

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tileKeys.map((key) => (
          <div
            key={key}
            className="rounded-xl border bg-card p-4 shadow-card"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-9 w-full lg:max-w-sm" />
        <Skeleton className="h-7 w-64" />
      </div>

      {/* Table */}
      <div className="mt-4 rounded-xl border bg-card p-4 shadow-card">
        <SkeletonTable rows={8} cols={6} />
      </div>
    </div>
  );
}
