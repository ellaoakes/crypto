import { redirect } from "next/navigation";

// Trip creation now lives in the onboarding wizard, which also collects
// the organizer's own dates/budget/preferences right after.
export default function NewTripPage() {
  redirect("/onboarding/trip");
}
