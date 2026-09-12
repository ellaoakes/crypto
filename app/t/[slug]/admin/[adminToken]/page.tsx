import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { GenerateSuggestionsButton } from "@/components/GenerateSuggestionsButton";
import { ChooseOptionButton } from "@/components/ChooseOptionButton";
import { RemindButton } from "@/components/RemindButton";
import { ProgressBar } from "@/components/ProgressBar";
import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { computeProgress } from "@/lib/trip-helpers";
import type { SuggestedOption } from "@/lib/types";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ slug: string; adminToken: string }>;
}) {
  const { slug, adminToken } = await params;

  const trip = await db.trip.findUnique({
    where: { slug },
    include: {
      participants: { include: { response: true, payment: true }, orderBy: { createdAt: "asc" } },
      suggestions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!trip || trip.adminToken !== adminToken) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const joinLink = `${baseUrl}/t/${trip.slug}/join`;
  const organiser = trip.participants.find((p) => p.isOrganiser);
  const progress = computeProgress(trip.participants);

  const latestSuggestion = trip.suggestions[0];
  const options: SuggestedOption[] = latestSuggestion ? JSON.parse(latestSuggestion.optionsJson) : [];
  const optionChosen = trip.chosenSuggestionId !== null;
  const showDeposits = trip.status === "collecting_deposits" || trip.status === "funded";

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm font-semibold text-coral-dark">Organiser dashboard</p>
        <h1 className="mt-1 font-heading text-3xl font-bold">{trip.title}</h1>

        <div className="card mt-8">
          <h2 className="mb-3 font-heading text-base font-semibold">Invite your friends</h2>
          <p className="mb-3 break-all rounded-lg bg-cream px-3 py-2 text-sm text-navy-soft">{joinLink}</p>
          <div className="flex flex-wrap gap-3">
            <CopyLinkButton link={joinLink} label="Copy invite link" />
            {organiser && (
              <CopyLinkButton link={`${baseUrl}/p/${organiser.token}`} label="Copy my own answer link" />
            )}
          </div>
        </div>

        <div className="card mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold">Responses</h2>
            <span className="text-sm font-medium text-navy-soft">
              {progress.responded} / {progress.total}
            </span>
          </div>
          <ProgressBar percent={progress.responsePercent} />
          <ul className="mt-4 space-y-1.5 text-sm">
            {trip.participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>
                  {p.name} {p.isOrganiser && <span className="text-xs text-navy-soft">(organiser)</span>}
                </span>
                <span className={p.response ? "text-coral-dark" : "text-navy-soft"}>
                  {p.response ? "Answered" : "Waiting"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {!optionChosen && (
          <div className="card mt-6">
            <h2 className="mb-1 font-heading text-base font-semibold">Suggestions</h2>
            <p className="mb-4 text-sm text-navy-soft">
              Reconciles everyone&rsquo;s private answers into a shortlist — works best once a few
              people have replied, but you can run it anytime.
            </p>
            <GenerateSuggestionsButton slug={trip.slug} adminToken={adminToken} />

            {options.length > 0 && (
              <div className="mt-6 grid gap-4">
                {options.map((option, i) => (
                  <div key={i} className="rounded-xl border border-border p-4">
                    <h3 className="font-heading font-semibold">{option.destination}</h3>
                    <p className="mt-1 text-sm text-navy-soft">{option.dateRange}</p>
                    <p className="mt-2 text-sm font-medium">
                      ~{formatPence(option.estimatedCostPerHeadPence)} per head
                    </p>
                    <p className="mt-2 text-sm text-navy-soft">{option.rationale}</p>
                    <div className="mt-4">
                      <ChooseOptionButton
                        slug={trip.slug}
                        adminToken={adminToken}
                        suggestionId={latestSuggestion.id}
                        optionIndex={i}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showDeposits && (
          <div className="card mt-6">
            {trip.status === "funded" && (
              <p className="mb-4 rounded-lg bg-cream-dark px-3 py-2 text-sm font-semibold text-coral-dark">
                🎉 Fully funded — every deposit is in.
              </p>
            )}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold">Deposit pot</h2>
              <span className="text-sm font-medium text-navy-soft">
                {progress.paid} / {progress.payable} paid
              </span>
            </div>
            <ProgressBar percent={progress.paidPercent} />
            <ul className="mt-4 space-y-1.5 text-sm">
              {trip.participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>{p.name}</span>
                  <span className={p.payment?.status === "paid" ? "text-coral-dark" : "text-navy-soft"}>
                    {p.payment?.status === "paid"
                      ? `Paid ${formatPence(p.payment.totalPence)}`
                      : p.payment
                        ? `Owes ${formatPence(p.payment.totalPence)}`
                        : "—"}
                  </span>
                </li>
              ))}
            </ul>
            {trip.status !== "funded" && (
              <div className="mt-5">
                <RemindButton slug={trip.slug} adminToken={adminToken} />
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
