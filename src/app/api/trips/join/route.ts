import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { apiError } from "@/lib/api-error";
import { joinTrip, TripError } from "@/lib/trips";
import { joinTripSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError(401, "UNAUTHENTICATED", "Sign in to join a trip.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = joinTripSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      422,
      "VALIDATION_ERROR",
      "That invite code doesn't look right.",
      parsed.error.flatten(),
    );
  }

  try {
    const trip = await joinTrip({
      inviteCode: parsed.data.inviteCode,
      userId: session.user.id,
    });
    return NextResponse.json({ data: trip });
  } catch (error) {
    if (error instanceof TripError) {
      return apiError(404, error.code, error.message);
    }
    console.error("Failed to join trip", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong joining the trip.");
  }
}
