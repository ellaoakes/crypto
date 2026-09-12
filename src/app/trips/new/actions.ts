"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createTrip } from "@/lib/trips";
import { createTripSchema } from "@/lib/validation";

export interface CreateTripActionState {
  error?: string;
}

export async function createTripAction(
  _prevState: CreateTripActionState,
  formData: FormData,
): Promise<CreateTripActionState> {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/trips/new");
  }

  const parsed = createTripSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a trip name." };
  }

  const trip = await createTrip({
    organizerId: session.user.id,
    name: parsed.data.name,
  });

  redirect(`/trips/${trip.id}`);
}
