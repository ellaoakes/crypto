import { z } from "zod";

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
