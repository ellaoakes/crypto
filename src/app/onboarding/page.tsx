import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

export default async function OnboardingWelcomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/onboarding/trip");
  }

  return (
    <OnboardingShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="text-6xl" aria-hidden="true">
          🌴✈️🎉
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold text-white">Group Trip</h1>
          <p className="mx-auto max-w-xs text-lg text-white/90">
            Plan the trip everyone actually agrees on — dates, budget and
            destination, sorted in minutes.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Link
            href="/onboarding/sign-in"
            className="flex h-14 w-full items-center justify-center rounded-full bg-white text-base font-semibold text-teal-800 shadow-lg transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-600"
          >
            Get started
          </Link>
          <p className="text-sm text-white/70">
            Free to use, no app download needed.
          </p>
        </div>
      </div>
    </OnboardingShell>
  );
}
