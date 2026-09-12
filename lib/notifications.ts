import { db } from "./db";

/**
 * Notification delivery abstraction. Defaults to logging to the server
 * console and to the in-app Notification table (which powers the
 * organiser's "reminders sent" feed) — no SMTP/SMS credentials required to
 * run the app. Swap `send()` for a real email/SMS implementation later;
 * everything upstream of this file stays the same.
 */
export interface NotificationChannel {
  send(input: { tripId: string; participantId?: string; message: string }): Promise<void>;
}

class ConsoleNotificationChannel implements NotificationChannel {
  async send({ tripId, participantId, message }: { tripId: string; participantId?: string; message: string }) {
    console.log(`[notification] trip=${tripId} participant=${participantId ?? "-"}: ${message}`);
    await db.notification.create({
      data: {
        tripId,
        participantId: participantId ?? null,
        channel: "console",
        message,
      },
    });
  }
}

let channel: NotificationChannel | null = null;

export function getNotificationChannel(): NotificationChannel {
  if (!channel) {
    channel = new ConsoleNotificationChannel();
  }
  return channel;
}
