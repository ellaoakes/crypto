import { prisma } from "@/lib/prisma";
import {
  TRANSPORTS,
  type NotificationTransport,
  type DeliverableNotification,
} from "@/lib/notifications/channels";
import { planNotifications, type PaymentEvent } from "@/lib/notifications/events";
import { CHANNELS, isEnabled, type Channel, type StoredPreference } from "@/lib/notifications/preferences";

/**
 * Taking an event and getting it to the people who should hear about it.
 *
 * The order matters: plan, store, then attempt delivery. Storing first means
 * a transport falling over never loses the fact that we decided to tell
 * someone something, and the unique dedupe key means an event replayed — a
 * retried webhook, a scan that runs twice — notifies nobody twice.
 */

export interface DispatchResult {
  /** Notifications newly created by this event. */
  created: number;
  /** Notifications this event would have created but had already. */
  duplicates: number;
  deliveries: { channel: Channel; status: string }[];
}

export async function dispatchPaymentEvent(
  event: PaymentEvent,
  now: Date = new Date(),
  transports: NotificationTransport[] = TRANSPORTS,
): Promise<DispatchResult> {
  const planned = planNotifications(event, now);
  const result: DispatchResult = { created: 0, duplicates: 0, deliveries: [] };

  for (const plan of planned) {
    let notification;
    try {
      notification = await prisma.notification.create({
        data: {
          userId: plan.userId,
          tripId: plan.tripId,
          type: plan.type,
          category: plan.category,
          title: plan.title,
          body: plan.body,
          href: plan.href,
          data: plan.data,
          dedupeKey: plan.dedupeKey,
        },
      });
      result.created += 1;
    } catch {
      // The dedupe key is taken: this person has already been told. Nothing
      // further to do, and deliberately not an error.
      result.duplicates += 1;
      continue;
    }

    const stored = await loadPreferences(plan.userId);

    for (const channel of CHANNELS) {
      const outcome = await attempt({
        channel,
        category: plan.category,
        stored,
        transports,
        notification: {
          id: notification.id,
          userId: notification.userId,
          type: notification.type,
          category: notification.category,
          title: notification.title,
          body: notification.body,
          href: notification.href,
          data: plan.data,
        },
      });

      await prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          channel,
          status: outcome.status,
          detail: outcome.detail,
        },
      });
      result.deliveries.push({ channel, status: outcome.status });
    }
  }

  return result;
}

async function attempt({
  channel,
  category,
  stored,
  transports,
  notification,
}: {
  channel: Channel;
  category: string;
  stored: StoredPreference[];
  transports: NotificationTransport[];
  notification: DeliverableNotification;
}): Promise<{ status: "SENT" | "SKIPPED" | "UNAVAILABLE" | "FAILED"; detail?: string }> {
  // The recipient's choice comes first: a channel they've switched off is
  // never attempted, so an unconfigured provider can't leak past a preference
  // and nothing is sent that somebody asked not to receive.
  if (!isEnabled(category as never, channel, stored)) {
    return { status: "SKIPPED", detail: "Turned off in notification settings." };
  }

  const transport = transports.find((candidate) => candidate.channel === channel);
  if (!transport) {
    return { status: "UNAVAILABLE", detail: "No transport registered for this channel." };
  }
  if (!transport.isAvailable()) {
    const outcome = await transport.send(notification);
    return { status: "UNAVAILABLE", detail: outcome.detail };
  }

  try {
    const outcome = await transport.send(notification);
    return outcome;
  } catch (error) {
    return {
      status: "FAILED",
      detail: error instanceof Error ? error.message : "Delivery failed.",
    };
  }
}

async function loadPreferences(userId: string): Promise<StoredPreference[]> {
  const rows = await prisma.notificationPreference.findMany({ where: { userId } });
  return rows.map((row) => ({
    category: row.category as StoredPreference["category"],
    channel: row.channel as Channel,
    enabled: row.enabled,
  }));
}

/** The signed-in user's in-app notifications, newest first. */
export async function getNotifications(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Marks a user's notifications read. Scoped to them — never anyone else's. */
export async function markAllRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}
