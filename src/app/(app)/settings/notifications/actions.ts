"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, CHANNELS, type Channel } from "@/lib/notifications/preferences";
import type { NotificationCategory } from "@/lib/notifications/events";

export async function setPreferenceAction(
  category: string,
  channel: string,
  enabled: boolean,
): Promise<{ error?: string; success?: true }> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in first." };

  // Only categories and channels this application actually knows about — the
  // client can't write arbitrary rows.
  if (!CATEGORIES.includes(category as NotificationCategory) || !CHANNELS.includes(channel as Channel)) {
    return { error: "That isn't a notification setting." };
  }

  await prisma.notificationPreference.upsert({
    where: {
      userId_category_channel: {
        userId: session.user.id,
        category: category as NotificationCategory,
        channel: channel as Channel,
      },
    },
    update: { enabled },
    create: {
      userId: session.user.id,
      category: category as NotificationCategory,
      channel: channel as Channel,
      enabled,
    },
  });

  revalidatePath("/settings/notifications");
  return { success: true };
}
