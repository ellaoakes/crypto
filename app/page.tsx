import Link from "next/link";
import { Header } from "@/components/Header";
import { JoinByCodeForm } from "@/components/JoinByCodeForm";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <section className="px-6 pb-16 pt-20 text-center">
          <p className="mx-auto mb-5 inline-block rounded-full bg-cream-dark px-4 py-1.5 text-sm font-semibold text-coral-dark">
            Now piloting stag &amp; hen weekends in Manchester
          </p>
          <h1 className="mx-auto max-w-2xl font-heading text-4xl font-extrabold sm:text-5xl">
            Stop chasing eleven mates for £80.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-navy-soft">
            Kitty turns &ldquo;we should do something for Dan&rdquo; into a booked, paid-for weekend —
            without you being the one nagging the group chat for a month.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/trip/new" className="btn-primary">
              Create a trip
            </Link>
            <Link href="#how-it-works" className="btn-ghost">
              See how it works ↓
            </Link>
          </div>
          <p className="mt-4 text-sm text-navy-soft">One link. No app to download. No signup for your mates.</p>
          <JoinByCodeForm />
        </section>

        <section id="how-it-works" className="bg-white px-6 py-16">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="font-heading text-3xl font-bold">From group chat to booked weekend.</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  n: 1,
                  title: "Create a trip, share one link",
                  body: "Drop it in the group chat. No app, no account needed for anyone but you.",
                },
                {
                  n: 2,
                  title: "Everyone answers 3 questions — privately",
                  body: "Dates they can't do, what they can spend, and where they'd like to go.",
                },
                {
                  n: 3,
                  title: "AI reconciles it into 2–3 real options",
                  body: "Built around the tightest budget in the group, so no one's priced out silently.",
                },
                {
                  n: 4,
                  title: "Deposits land in one pot, automatically",
                  body: "Kitty sends the reminders and chases the stragglers. You just show up.",
                },
              ].map((step) => (
                <div key={step.n}>
                  <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-coral font-heading font-bold text-white">
                    {step.n}
                  </span>
                  <h3 className="mb-1.5 font-heading text-base font-semibold">{step.title}</h3>
                  <p className="text-sm text-navy-soft">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 py-16">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="font-heading text-3xl font-bold">Simple, honest pricing.</h2>
            <div className="card mt-8 max-w-lg">
              <p className="font-heading text-4xl font-extrabold text-coral-dark">
                £5
                <span className="mt-1 block font-body text-base font-medium text-navy-soft">
                  per person, added on top of their contribution when they pay their deposit
                </span>
              </p>
              <p className="mt-4 text-sm text-navy-soft">
                Nothing for the organiser to pay, ever. It&rsquo;s a flat fee on each participant&rsquo;s
                deposit — smaller than a round of drinks.
              </p>
            </div>
          </div>
        </section>

        <section id="faq" className="bg-white px-6 py-16">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="font-heading text-3xl font-bold">Questions people ask</h2>
            <div className="mt-8 flex flex-col gap-3">
              {[
                {
                  q: "Is there an app to download?",
                  a: "No. Kitty works in your phone's browser — no download, no update. Only the organiser needs to keep the trip's admin link.",
                },
                {
                  q: "How does the deposit actually get collected?",
                  a: "Once the group picks an option, everyone gets a personal payment link showing exactly what they owe — their share plus a flat £5 fee — and confirms it. This build uses a clearly-labelled test-mode payment step; a real open banking provider and regulatory sign-off come before any real money moves.",
                },
                {
                  q: "What if someone doesn't pay?",
                  a: "The organiser dashboard shows what percentage of the pot is in, and can send an automatically-drafted reminder to whoever's outstanding — so the nagging comes from Kitty, not a friend.",
                },
                {
                  q: "What does the AI actually do?",
                  a: "It reconciles everyone's private dates, budget and destination answers into a shortlist of concrete options, and drafts the reminder message. Everything else is ordinary software.",
                },
              ].map((item) => (
                <details key={item.q} className="rounded-xl bg-cream p-4 shadow-card">
                  <summary className="cursor-pointer font-semibold marker:content-none">{item.q}</summary>
                  <p className="mt-3 text-sm text-navy-soft">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16 text-center">
          <h2 className="font-heading text-3xl font-bold">Ready to stop being the one who chases?</h2>
          <Link href="/trip/new" className="btn-primary mt-6 inline-flex">
            Create a trip
          </Link>
        </section>
      </main>

      <footer className="bg-cream-dark px-6 py-10 text-sm text-navy-soft">
        <div className="mx-auto max-w-[1100px]">
          <p className="font-heading font-bold text-navy">🐱 Kitty</p>
          <p className="mt-2 max-w-md">
            &ldquo;Kitty&rdquo; is a working name. Payment and messaging in this build run in test mode
            while the idea is validated with real trips.
          </p>
        </div>
      </footer>
    </>
  );
}
