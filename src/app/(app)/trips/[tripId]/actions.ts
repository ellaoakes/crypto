"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { lockTrip, reopenTrip, TripError } from "@/lib/trips";

export interface TripLockActionResult {
  success?: true;
  error?: string;
}

function revalidateTrip(tripId: string) {
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/vote`);
  revalidatePath(`/trips/${tripId}/discover`);
}

export async function lockTripAction(
  tripId: string,
  destinationId: string,
): Promise<TripLockActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sign in first." };
  }

  try {
    await lockTrip({ tripId, userId: session.user.id, destinationId });
    revalidateTrip(tripId);
    return { success: true };
  } catch (error) {
    if (error instanceof TripError) {
      return { error: error.message };
    }
    console.error("Failed to lock trip", error);
    return { error: "Something went wrong locking the trip." };
  }
}

export async function reopenTripAction(tripId: string): Promise<TripLockActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sign in first." };
  }

  try {
    await reopenTrip({ tripId, userId: session.user.id });
    revalidateTrip(tripId);
    return { success: true };
  } catch (error) {
    if (error instanceof TripError) {
      return { error: error.message };
    }
    console.error("Failed to reopen trip", error);
    return { error: "Something went wrong reopening the trip." };
  }
}
