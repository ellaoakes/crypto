import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { JoinTripForm } from "@/components/JoinTripForm";
import { db } from "@/lib/db";

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await db.trip.findUnique({ where: { slug } });
  if (!trip) notFound();

  return (
    <>
      <Header />
      <main className="px-6 py-16">
        <div className="mx-auto max-w-md text-center">
          <p className="text-sm font-semibold text-coral-dark">You&rsquo;ve been invited to</p>
          <h1 className="mt-1 font-heading text-3xl font-bold">{trip.title}</h1>
          <p className="mt-3 mb-8 text-navy-soft">
            Just your name for now — you&rsquo;ll answer three quick questions next, privately.
          </p>
        </div>
        <JoinTripForm slug={slug} />
      </main>
    </>
  );
}
