import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { MarkAllReadButton } from "@/components/notifications/MarkAllReadButton";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { countUnread, getNotifications } from "@/lib/notifications/dispatch";

function when(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/notifications");
  }

  const [notifications, unread] = await Promise.all([
    getNotifications(session.user.id),
    countUnread(session.user.id),
  ]);

  return (
    <Container className="flex flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold text-teal-950">Notifications</h1>
          <p className="text-sm text-teal-950/60">
            {unread > 0 ? `${unread} unread` : "Nothing new"}
          </p>
        </div>
        <Link href="/settings/notifications" className="shrink-0 text-sm text-teal-700 hover:underline">
          Settings
        </Link>
      </div>

      {unread > 0 ? <MarkAllReadButton /> : null}

      {notifications.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="Payment updates for your trips will show up here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link href={notification.href ?? "/"}>
                <Card
                  className={
                    notification.readAt
                      ? "transition-colors hover:border-teal-300"
                      : "border-teal-300 bg-teal-50/60 transition-colors hover:border-teal-400"
                  }
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-teal-950">{notification.title}</p>
                      <span className="shrink-0 text-xs text-teal-950/50">
                        {when(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-teal-950/70">{notification.body}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
