"use server";

import { auth } from "@/auth";
import {
  BUDGET_BANDS,
  TRIP_LENGTH_OPTIONS,
} from "@/lib/onboarding-options";
import { createTrip, submitParticipantOnboarding, TripError } from "@/lib/trips";
import { completeOnboardingSchema, createTripSchema } from "@/lib/validation";

export interface StartTripResult {
  trip?: { id: string; name: string; inviteCode: string };
  error?: string;
}

export async function startTripAction(name: string): Promise<StartTripResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Your session expired. Please sign in again." };
  }

  const parsed = createTripSchema.safeParse({ name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a trip name." };
  }

  const trip = await createTrip({
    organizerId: session.user.id,
    name: parsed.data.name,
  });

  return {
    trip: { id: trip.id, name: trip.name, inviteCode: trip.inviteCode },
  };
}

export interface CompleteOnboardingInput {
  tripId: string;
  tripLengthKey: string;
  months: string[];
  isFlexibleOnDates: boolean;
  budgetKey: string;
  preferences: string[];
}

export interface CompleteOnboardingResult {
  success?: true;
  error?: string;
}

export async function completeOnboardingAction(
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Your session expired. Please sign in again." };
  }

  const parsed = completeOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Something doesn't look right.",
    };
  }

  const tripLength = TRIP_LENGTH_OPTIONS.find(
    (option) => option.key === parsed.data.tripLengthKey,
  );
  const budget = BUDGET_BANDS.find((option) => option.key === parsed.data.budgetKey);

  if (!tripLength || !budget) {
    return { error: "Something doesn't look right." };
  }

  try {
    await submitParticipantOnboarding({
      tripId: parsed.data.tripId,
      userId: session.user.id,
      months: parsed.data.months,
      isFlexibleOnDates: parsed.data.isFlexibleOnDates,
      budgetPerPerson: budget.value,
      tripLengthMinDays: tripLength.minDays,
      tripLengthMaxDays: tripLength.maxDays,
      preferences: parsed.data.preferences,
    });
  } catch (error) {
    if (error instanceof TripError) {
      return { error: error.message };
    }
    console.error("Failed to complete onboarding", error);
    return { error: "Something went wrong saving your answers." };
  }

  return { success: true };
}
