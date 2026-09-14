/**
 * How a notification actually reaches someone.
 *
 * Deliberately provider-agnostic. A channel is anything that can take a
 * notification and try to deliver it; the dispatcher doesn't know or care
 * which. In-app is implemented, because it needs nothing but a row that the
 * app already stores. Email and push are registered but unconfigured: they
 * report themselves unavailable and the attempt is recorded as such, so the
 * pipeline is complete and observable before any provider is chosen.
 *
 * Adding a provider later means writing one `send` and flipping
 * `isAvailable`. Nothing else changes.
 */
import type { Channel } from "@/lib/notifications/preferences";

export interface DeliverableNotification {
  id: string;
  userId: string;
  type: string;
  category: string;
  title: string;
  body: string;
  href: string | null;
  data: Record<string, unknown>;
}

export interface DeliveryOutcome {
  status: "SENT" | "UNAVAILABLE" | "FAILED";
  detail?: string;
}

export interface NotificationTransport {
  channel: Channel;
  /** False when no provider is configured; the dispatcher records why. */
  isAvailable(): boolean;
  send(notification: DeliverableNotification): Promise<DeliveryOutcome>;
}

/**
 * In-app delivery. The notification row *is* the delivery — writing it is
 * what puts it in the user's list — so this only has to confirm that.
 */
export const inAppTransport: NotificationTransport = {
  channel: "IN_APP",
  isAvailable: () => true,
  async send(): Promise<DeliveryOutcome> {
    return { status: "SENT" };
  },
};

/**
 * Email. No provider is wired up: the app has SMTP for sign-in links, but
 * transactional notification email wants templates, an unsubscribe path and
 * a sending domain — decisions this step deliberately doesn't make.
 */
export const emailTransport: NotificationTransport = {
  channel: "EMAIL",
  isAvailable: () => false,
  async send(): Promise<DeliveryOutcome> {
    return { status: "UNAVAILABLE", detail: "No email provider is configured yet." };
  },
};

/** Push. No provider, no device tokens, nothing to send to yet. */
export const pushTransport: NotificationTransport = {
  channel: "PUSH",
  isAvailable: () => false,
  async send(): Promise<DeliveryOutcome> {
    return { status: "UNAVAILABLE", detail: "No push provider is configured yet." };
  },
};

export const TRANSPORTS: NotificationTransport[] = [
  inAppTransport,
  emailTransport,
  pushTransport,
];

export function transportFor(channel: Channel): NotificationTransport | undefined {
  return TRANSPORTS.find((transport) => transport.channel === channel);
}
