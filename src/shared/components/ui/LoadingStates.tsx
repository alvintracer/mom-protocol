export function LoadingBar() {
  return (
    <div className="h-1 w-full overflow-hidden bg-muted">
      <div className="h-full w-1/3 animate-[moment-loading_1.1s_ease-in-out_infinite] rounded-full bg-blue-600" />
    </div>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse p-4">
          <div className="flex gap-3">
            <div className="size-10 rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-24 rounded-full bg-muted" />
                <div className="h-3 w-14 rounded-full bg-muted" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded-full bg-muted" />
                <div className="h-3 w-4/5 rounded-full bg-muted" />
              </div>
              <div className="flex gap-5">
                <div className="h-3 w-10 rounded-full bg-muted" />
                <div className="h-3 w-10 rounded-full bg-muted" />
                <div className="h-3 w-10 rounded-full bg-muted" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AttentionGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1450px]:grid-cols-4 min-[1900px]:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="min-h-48 animate-pulse rounded-2xl border border-border bg-background p-3.5"
        >
          <div className="h-3 w-24 rounded-full bg-muted" />
          <div className="mt-4 h-4 w-11/12 rounded-full bg-muted" />
          <div className="mt-2 h-4 w-4/5 rounded-full bg-muted" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded-full bg-muted" />
            <div className="h-3 w-3/4 rounded-full bg-muted" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="h-12 rounded-lg bg-muted" />
            <div className="h-12 rounded-lg bg-muted" />
            <div className="h-12 rounded-lg bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <LoadingBar />
      <div className="animate-pulse p-6">
        <div className="h-28 rounded-2xl bg-muted" />
        <div className="mt-6 h-5 w-2/3 rounded-full bg-muted" />
        <div className="mt-3 h-4 w-full rounded-full bg-muted" />
        <div className="mt-2 h-4 w-5/6 rounded-full bg-muted" />
        <div className="mt-8">
          <FeedSkeleton count={3} />
        </div>
      </div>
    </div>
  );
}
