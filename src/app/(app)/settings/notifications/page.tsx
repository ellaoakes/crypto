import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PreferenceGrid } from "@/components/notifications/PreferenceGrid";
import { Container } from "@/components/ui/Container";
import { transportFor } from "@/lib/notifications/channels";
import { CHANNELS, resolvePreferences, type Channel, type StoredPreference } from "@/lib/notifications/preferences";
import { prisma } from "@/lib/prisma";

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/settings/notifications");
  }

  const stored = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
  });

  const grid = resolvePreferences(
    stored.map((row) => ({
      category: row.category,
      channel: row.channel,
      enabled: row.enabled,
    })) as StoredPreference[],
  );

  const channelAvailability = Object.fromEntries(
    CHANNELS.map((channel) => [channel, transportFor(channel)?.isAvailable() ?? false]),
  ) as Record<Channel, boolean>;

  return (
    <Container className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/notifications" className="text-sm text-teal-700 hover:underline">
          ← Back to notifications
        </Link>
        <h1 className="text-xl font-semibold text-teal-950">Notification settings</h1>
        <p className="text-sm text-teal-950/60">
          Choose what reaches you, and how.
        </p>
      </div>

      <PreferenceGrid initial={grid} channelAvailability={channelAvailability} />
    </Container>
  );
}
