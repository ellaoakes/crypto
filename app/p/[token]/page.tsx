import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { ResponseForm } from "@/components/ResponseForm";
import { PayButton } from "@/components/PayButton";
import { ProgressBar } from "@/components/ProgressBar";
import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { getChosenOption, computeProgress } from "@/lib/trip-helpers";

export default async function ParticipantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const participant = await db.participant.findUnique({
    where: { token },
    include: {
      response: true,
      payment: true,
      trip: { include: { participants: { include: { response: true, payment: true } } } },
    },
  });
  if (!participant) notFound();

  const { trip } = participant;
  const progress = computeProgress(trip.participants);
  const chosenOption = await getChosenOption(trip);

  return (
    <>
      <Header />
      <main className="px-6 py-16">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-sm font-semibold text-coral-dark">{trip.title}</p>
          <h1 className="mt-1 font-heading text-2xl font-bold">Hey {participant.name} 👋</h1>
        </div>

        <div className="mx-auto mt-8 max-w-lg">
          {!participant.response && <ResponseForm token={token} />}

          {participant.response && trip.status !== "collecting_deposits" && trip.status !== "funded" && (
            <div className="card text-center">
              <h2 className="mb-2 font-heading text-lg font-semibold">Thanks — you&rsquo;re in.</h2>
              <p className="mb-5 text-sm text-navy-soft">
                Waiting on the rest of the group to answer before options get suggested.
              </p>
              <p className="mb-2 text-sm font-medium">
                {progress.responded} of {progress.total} have answered
              </p>
              <ProgressBar percent={progress.responsePercent} />
            </div>
          )}

          {(trip.status === "collecting_deposits" || trip.status === "funded") && chosenOption && participant.payment && (
            <div className="card">
              <p className="text-sm font-semibold text-coral-dark">The group picked</p>
              <h2 className="mt-1 font-heading text-xl font-bold">{chosenOption.destination}</h2>
              <p className="mt-1 text-sm text-navy-soft">{chosenOption.dateRange}</p>

              <div className="my-6 border-t border-border" />

              {participant.payment.status === "paid" ? (
                <>
                  <p className="font-semibold text-coral-dark">✅ Your deposit is in.</p>
                  <p className="mt-1 text-sm text-navy-soft">You&rsquo;re all set — see you there.</p>
                </>
              ) : (
                <>
                  <dl className="mb-5 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-navy-soft">Your contribution</dt>
                      <dd>{formatPence(participant.payment.contributionPence)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-navy-soft">Processing fee</dt>
                      <dd>{formatPence(participant.payment.feePence)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 font-semibold">
                      <dt>Total due</dt>
                      <dd>{formatPence(participant.payment.totalPence)}</dd>
                    </div>
                  </dl>
                  <PayButton token={token} />
                  <p className="mt-3 text-center text-xs text-navy-soft">
                    Test-mode payment — no real money moves in this build.
                  </p>
                </>
              )}

              <div className="mt-6 border-t border-border pt-5">
                <p className="mb-2 text-sm font-medium">{progress.paidPercent}% of the group has paid</p>
                <ProgressBar percent={progress.paidPercent} />
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
