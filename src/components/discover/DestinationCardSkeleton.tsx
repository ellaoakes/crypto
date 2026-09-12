export function DestinationCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm"
    >
      <div className="h-20 bg-teal-100" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-2/5 rounded bg-teal-100" />
          <div className="h-4 w-1/3 rounded bg-teal-100" />
          <div className="h-3 w-3/5 rounded bg-teal-100" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-4/5 rounded bg-teal-50" />
          <div className="h-3 w-3/4 rounded bg-teal-50" />
          <div className="h-3 w-2/3 rounded bg-teal-50" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 flex-1 rounded-lg bg-teal-100" />
          <div className="h-11 flex-1 rounded-lg bg-teal-100" />
        </div>
      </div>
    </div>
  );
}
