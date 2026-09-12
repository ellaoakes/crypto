import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const participant = await db.participant.findUnique({
    where: { token },
    include: { payment: true, trip: { include: { participants: { include: { payment: true } } } } },
  });
  if (!participant || !participant.payment) {
    return NextResponse.json({ error: "No payment due" }, { status: 404 });
  }
  if (participant.payment.status === "paid") {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }

  const provider = getPaymentProvider();
  const result = await provider.confirmPayment({
    reference: participant.payment.reference,
    totalPence: participant.payment.totalPence,
  });

  await db.payment.update({
    where: { id: participant.payment.id },
    data: { status: "paid", paidAt: result.confirmedAt },
  });

  const allOtherPayments = participant.trip.participants
    .filter((p) => p.id !== participant.id)
    .map((p) => p.payment);
  const allPaid = allOtherPayments.every((p) => p?.status === "paid");

  if (allPaid) {
    await db.trip.update({ where: { id: participant.trip.id }, data: { status: "funded" } });
  }

  return NextResponse.json({ ok: true, provider: provider.name });
}
