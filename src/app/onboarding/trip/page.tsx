import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingTripPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/onboarding/sign-in");
  }

  const firstName = session.user.name?.split(" ")[0];

  return <OnboardingWizard userName={firstName} />;
}
