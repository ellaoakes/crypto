/**
 * What arrives, and on which channel.
 *
 * Pure resolution: given a user's stored overrides, decide whether one
 * category on one channel is on. Defaults matter more than the override
 * machinery, so they're stated plainly here rather than scattered.
 */
import type { NotificationCategory } from "@/lib/notifications/events";

export type Channel = "IN_APP" | "EMAIL" | "PUSH";

export const CHANNELS: Channel[] = ["IN_APP", "EMAIL", "PUSH"];

export const CATEGORIES: NotificationCategory[] = [
  "PAYMENT_RECEIPT",
  "PAYMENT_PROBLEM",
  "PAYMENT_REMINDER",
  "TRIP_PAYMENT_ACTIVITY",
];

export const CATEGORY_LABELS: Record<NotificationCategory, { title: string; description: string }> = {
  PAYMENT_RECEIPT: {
    title: "Your payments",
    description: "When one of your own payments goes through.",
  },
  PAYMENT_PROBLEM: {
    title: "Payment problems",
    description: "When one of your payments fails and needs another go.",
  },
  PAYMENT_REMINDER: {
    title: "Payment reminders",
    description: "When you owe money, or a deadline is close or missed.",
  },
  TRIP_PAYMENT_ACTIVITY: {
    title: "Activity on trips you organise",
    description: "When someone on a trip you organise pays their share.",
  },
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  IN_APP: "In-app",
  EMAIL: "Email",
  PUSH: "Push",
};

/**
 * What someone gets if they never touch their settings.
 *
 * In-app is on for everything: it's a list they choose to look at, so it
 * costs them nothing. Email is reserved for the things that need acting on —
 * a failed payment, money owed — and is off for routine receipts and other
 * people's activity, which would otherwise be most of the mail. Push is off
 * everywhere until someone asks for it; an app that starts buzzing on
 * install is an app people mute.
 */
export const DEFAULT_PREFERENCES: Record<NotificationCategory, Record<Channel, boolean>> = {
  PAYMENT_RECEIPT: { IN_APP: true, EMAIL: false, PUSH: false },
  PAYMENT_PROBLEM: { IN_APP: true, EMAIL: true, PUSH: false },
  PAYMENT_REMINDER: { IN_APP: true, EMAIL: true, PUSH: false },
  TRIP_PAYMENT_ACTIVITY: { IN_APP: true, EMAIL: false, PUSH: false },
};

export interface StoredPreference {
  category: NotificationCategory;
  channel: Channel;
  enabled: boolean;
}

export function isEnabled(
  category: NotificationCategory,
  channel: Channel,
  stored: StoredPreference[],
): boolean {
  const override = stored.find(
    (preference) => preference.category === category && preference.channel === channel,
  );
  return override ? override.enabled : DEFAULT_PREFERENCES[category][channel];
}

/** The full grid, for rendering a settings screen. */
export function resolvePreferences(
  stored: StoredPreference[],
): Record<NotificationCategory, Record<Channel, boolean>> {
  const resolved = {} as Record<NotificationCategory, Record<Channel, boolean>>;

  for (const category of CATEGORIES) {
    resolved[category] = {} as Record<Channel, boolean>;
    for (const channel of CHANNELS) {
      resolved[category][channel] = isEnabled(category, channel, stored);
    }
  }

  return resolved;
}
