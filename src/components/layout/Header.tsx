import Link from "next/link";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-teal-100">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold text-teal-950">
          Group Trip
        </Link>
        {session?.user ? (
          <SignOutButton />
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
