"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { joinTrip, TripError } from "@/lib/trips";

export interface JoinTripActionState {
  error?: string;
}

export async function joinTripAction(
  _prevState: JoinTripActionState,
  formData: FormData,
): Promise<JoinTripActionState> {
  const inviteCode = formData.get("inviteCode");
  if (typeof inviteCode !== "string" || !inviteCode) {
    return { error: "That invite link is missing its code." };
  }

  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=/join/${inviteCode}`);
  }

  try {
    const trip = await joinTrip({ inviteCode, userId: session.user.id });
    redirect(`/trips/${trip.id}`);
  } catch (error) {
    if (error instanceof TripError) {
      return { error: error.message };
    }
    // Includes the internal Next.js redirect signal on success — must propagate.
    throw error;
  }
}
