"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  completeOnboardingAction,
  startTripAction,
} from "@/app/onboarding/trip/actions";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { BudgetStep } from "@/components/onboarding/steps/BudgetStep";
import { CompleteStep } from "@/components/onboarding/steps/CompleteStep";
import { CreateTripIntroStep } from "@/components/onboarding/steps/CreateTripIntroStep";
import { DatesStep } from "@/components/onboarding/steps/DatesStep";
import { InviteFriendsStep } from "@/components/onboarding/steps/InviteFriendsStep";
import { PreferencesStep } from "@/components/onboarding/steps/PreferencesStep";
import { TripLengthStep } from "@/components/onboarding/steps/TripLengthStep";
import { TripNameStep } from "@/components/onboarding/steps/TripNameStep";
import { WhoIsGoingStep } from "@/components/onboarding/steps/WhoIsGoingStep";
import type {
  BudgetBandKey,
  GroupSizeKey,
  TravelPreferenceKey,
  TripLengthKey,
} from "@/lib/onboarding-options";

const STEPS = [
  "intro",
  "name",
  "whoGoing",
  "invite",
  "length",
  "dates",
  "budget",
  "preferences",
  "complete",
] as const;

type Step = (typeof STEPS)[number];

interface Answers {
  tripName: string;
  groupSize: GroupSizeKey | null;
  tripLengthKey: TripLengthKey | null;
  months: string[];
  isFlexibleOnDates: boolean;
  budgetKey: BudgetBandKey | null;
  preferences: TravelPreferenceKey[];
}

const INITIAL_ANSWERS: Answers = {
  tripName: "",
  groupSize: null,
  tripLengthKey: null,
  months: [],
  isFlexibleOnDates: false,
  budgetKey: null,
  preferences: [],
};

interface TripInfo {
  id: string;
  name: string;
  inviteCode: string;
}

export function OnboardingWizard({ userName }: { userName?: string | null }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [trip, setTrip] = useState<TripInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const step: Step = STEPS[stepIndex];
  const progress = stepIndex / (STEPS.length - 1);

  function updateAnswers(patch: Partial<Answers>) {
    setAnswers((prev) => ({ ...prev, ...patch }));
  }

  function goNext() {
    setError(null);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function handleCreateTrip() {
    setError(null);
    startTransition(async () => {
      const result = await startTripAction(answers.tripName);
      if (result.error || !result.trip) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      setTrip(result.trip);
      goNext();
    });
  }

  function toggleMonth(month: string) {
    setAnswers((prev) => ({
      ...prev,
      isFlexibleOnDates: false,
      months: prev.months.includes(month)
        ? prev.months.filter((m) => m !== month)
        : [...prev.months, month],
    }));
  }

  function toggleFlexible() {
    setAnswers((prev) => ({
      ...prev,
      isFlexibleOnDates: !prev.isFlexibleOnDates,
      months: [],
    }));
  }

  function togglePreference(key: TravelPreferenceKey) {
    setAnswers((prev) => ({
      ...prev,
      preferences: prev.preferences.includes(key)
        ? prev.preferences.filter((p) => p !== key)
        : [...prev.preferences, key],
    }));
  }

  function handleFinish() {
    if (!trip || !answers.tripLengthKey || !answers.budgetKey) {
      setError("Something went wrong. Please try again.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await completeOnboardingAction({
        tripId: trip.id,
        tripLengthKey: answers.tripLengthKey!,
        months: answers.months,
        isFlexibleOnDates: answers.isFlexibleOnDates,
        budgetKey: answers.budgetKey!,
        preferences: answers.preferences,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      goNext();
    });
  }

  const showBack = step !== "intro" && step !== "complete";
  const inviteUrl =
    trip && typeof window !== "undefined"
      ? `${window.location.origin}/join/${trip.inviteCode}`
      : "";

  return (
    <OnboardingShell
      progress={step === "complete" ? 1 : progress}
      onBack={showBack ? goBack : undefined}
    >
      {step === "intro" && (
        <CreateTripIntroStep userName={userName} onContinue={goNext} />
      )}

      {step === "name" && (
        <TripNameStep
          name={answers.tripName}
          onChange={(tripName) => updateAnswers({ tripName })}
          onContinue={handleCreateTrip}
          isPending={isPending}
          error={error}
        />
      )}

      {step === "whoGoing" && (
        <WhoIsGoingStep
          value={answers.groupSize}
          onChange={(groupSize) => updateAnswers({ groupSize })}
          onContinue={goNext}
        />
      )}

      {step === "invite" && trip && (
        <InviteFriendsStep
          tripName={trip.name}
          inviteUrl={inviteUrl}
          onContinue={goNext}
        />
      )}

      {step === "length" && (
        <TripLengthStep
          value={answers.tripLengthKey}
          onChange={(tripLengthKey) => updateAnswers({ tripLengthKey })}
          onContinue={goNext}
        />
      )}

      {step === "dates" && (
        <DatesStep
          months={answers.months}
          isFlexible={answers.isFlexibleOnDates}
          onToggleMonth={toggleMonth}
          onToggleFlexible={toggleFlexible}
          onContinue={goNext}
        />
      )}

      {step === "budget" && (
        <BudgetStep
          value={answers.budgetKey}
          onChange={(budgetKey) => updateAnswers({ budgetKey })}
          onContinue={goNext}
        />
      )}

      {step === "preferences" && (
        <PreferencesStep
          selected={answers.preferences}
          onToggle={togglePreference}
          onFinish={handleFinish}
          isPending={isPending}
          error={error}
        />
      )}

      {step === "complete" && trip && (
        <CompleteStep
          tripName={trip.name}
          onGoToTrip={() => router.push(`/trips/${trip.id}`)}
        />
      )}
    </OnboardingShell>
  );
}
