import Link from "next/link";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { countUnread } from "@/lib/notifications/dispatch";

export async function Header() {
  const session = await auth();
  const unread = session?.user ? await countUnread(session.user.id) : 0;

  return (
    <header className="border-b border-teal-100">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold text-teal-950">
          Group Trip
        </Link>
        {session?.user ? (
          <div className="flex items-center gap-1">
            <Link
              href="/notifications"
              aria-label={
                unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
              }
              className="relative rounded-lg px-3 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <span aria-hidden="true">🔔</span>
              {unread > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-700 px-1 text-[0.625rem] font-semibold text-white"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <SignOutButton />
          </div>
        ) : (
          <Link
            href="/sign-in"
            className="rounded-lg px-3 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
