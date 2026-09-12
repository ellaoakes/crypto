import Link from "next/link";
import { Header } from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="px-6 py-24 text-center">
        <h1 className="font-heading text-2xl font-bold">Couldn&rsquo;t find that.</h1>
        <p className="mt-3 text-navy-soft">The link might be wrong, or the trip may not exist.</p>
        <Link href="/" className="btn-primary mt-6 inline-flex">
          Back to Kitty
        </Link>
      </main>
    </>
  );
}
