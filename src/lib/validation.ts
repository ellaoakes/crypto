import { z } from "zod";

import {
  BUDGET_BANDS,
  TRAVEL_PREFERENCES,
  TRIP_LENGTH_OPTIONS,
} from "@/lib/onboarding-options";

const tripLengthKeys = TRIP_LENGTH_OPTIONS.map((option) => option.key) as [
  string,
  ...string[],
];
const budgetBandKeys = BUDGET_BANDS.map((option) => option.key) as [
  string,
  ...string[],
];
const travelPreferenceKeys = TRAVEL_PREFERENCES.map((option) => option.key) as [
  string,
  ...string[],
];

export const completeOnboardingSchema = z
  .object({
    tripId: z.string().min(1),
    tripLengthKey: z.enum(tripLengthKeys),
    months: z.array(z.string().regex(/^\d{4}-\d{2}$/)).default([]),
    isFlexibleOnDates: z.boolean().default(false),
    budgetKey: z.enum(budgetBandKeys),
    preferences: z.array(z.enum(travelPreferenceKeys)).max(8),
  })
  .refine((data) => data.isFlexibleOnDates || data.months.length > 0, {
    message: "Pick at least one month, or tell us you're flexible.",
    path: ["months"],
  });

export const createTripSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the trip a name (at least 2 characters).")
    .max(80, "Keep the trip name under 80 characters."),
});

export const joinTripSchema = z.object({
  inviteCode: z.string().trim().min(1, "An invite code is required."),
});

export const emailSchema = z.email("Enter a valid email address.");
