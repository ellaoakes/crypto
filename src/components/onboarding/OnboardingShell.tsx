import Link from "next/link";
import type { ReactNode } from "react";

import { ChevronLeftIcon } from "@/components/onboarding/icons";

export function OnboardingShell({
  progress,
  onBack,
  backHref,
  children,
}: {
  /** 0–1, or omit to hide the progress bar (e.g. on the welcome screen). */
  progress?: number;
  /** Client-side back (wizard step navigation). */
  onBack?: () => void;
  /** Server-friendly back link, used instead of `onBack` on server pages. */
  backHref?: string;
  children: ReactNode;
}) {
  const backButtonClasses =
    "flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-400"
    >
      <div className="flex items-center gap-3 px-5 pb-2 pt-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className={backButtonClasses}
          >
            <ChevronLeftIcon className="size-5" />
          </button>
        ) : backHref ? (
          <Link href={backHref} aria-label="Go back" className={backButtonClasses}>
            <ChevronLeftIcon className="size-5" />
          </Link>
        ) : null}
        {progress !== undefined ? (
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25"
          >
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        ) : null}
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-4">
        {children}
      </div>
    </main>
  );
}
