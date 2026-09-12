import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-teal-200 px-6 py-10 text-center">
      <p className="font-medium text-teal-950">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-teal-950/60">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
