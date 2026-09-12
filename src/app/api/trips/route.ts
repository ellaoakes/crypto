import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { apiError } from "@/lib/api-error";
import { createTrip, getTripsForUser } from "@/lib/trips";
import { createTripSchema } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return apiError(401, "UNAUTHENTICATED", "Sign in to see your trips.");
  }

  const trips = await getTripsForUser(session.user.id);
  return NextResponse.json({ data: trips });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError(401, "UNAUTHENTICATED", "Sign in to create a trip.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = createTripSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      422,
      "VALIDATION_ERROR",
      "Check the trip details and try again.",
      parsed.error.flatten(),
    );
  }

  try {
    const trip = await createTrip({
      organizerId: session.user.id,
      name: parsed.data.name,
    });
    return NextResponse.json({ data: trip }, { status: 201 });
  } catch (error) {
    console.error("Failed to create trip", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong creating your trip.");
  }
}
