import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInForm } from "@/components/auth/SignInForm";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { StepHeading } from "@/components/onboarding/StepHeading";

export default async function OnboardingSignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/onboarding/trip");
  }

  return (
    <OnboardingShell progress={0.1} backHref="/onboarding">
      <StepHeading
        eyebrow="Step 1 of 2"
        title="Let's get you signed in"
        subtitle="We'll email you a link — no password to remember."
      />
      <div className="rounded-2xl bg-white p-5 shadow-lg">
        <SignInForm callbackUrl="/onboarding/trip" />
      </div>
    </OnboardingShell>
  );
}
