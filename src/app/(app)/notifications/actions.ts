"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { markAllRead } from "@/lib/notifications/dispatch";

export async function markAllReadAction(): Promise<{ error?: string; count?: number }> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in first." };

  // Scoped to the signed-in user — there is no parameter for whose to clear.
  const count = await markAllRead(session.user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { count };
}
