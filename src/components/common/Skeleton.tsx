export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-base-600/60 ${className}`}
      aria-hidden
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="card space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="card border-status-high/40">
      <p className="text-sm font-semibold text-status-high">Data error</p>
      <p className="mt-1 text-sm text-slate-300">{message}</p>
      <p className="mt-2 text-xs text-slate-500">
        API failures are surfaced, not hidden. Try refreshing or switch to Demo
        Mode.
      </p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-base-500 p-6 text-sm text-slate-400">
      {message}
    </div>
  );
}
