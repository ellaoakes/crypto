import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="font-heading text-xl font-bold text-navy">
          🐱 Kitty
        </Link>
        <nav className="hidden gap-7 text-sm font-medium text-navy-soft sm:flex">
          <Link href="/#how-it-works" className="hover:text-coral-dark">
            How it works
          </Link>
          <Link href="/#pricing" className="hover:text-coral-dark">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-coral-dark">
            FAQ
          </Link>
        </nav>
        <Link href="/trip/new" className="btn-primary !px-5 !py-2.5 !text-[0.85rem]">
          Create a trip
        </Link>
      </div>
    </header>
  );
}
