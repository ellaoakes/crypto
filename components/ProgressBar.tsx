export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream-dark">
      <div className="h-full rounded-full bg-coral transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}
