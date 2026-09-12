import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { draftReminderMessage } from "@/lib/ai";
import { formatPence } from "@/lib/money";
import { getNotificationChannel } from "@/lib/notifications";

const schema = z.object({ adminToken: z.string() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing admin token" }, { status: 400 });
  }

  const trip = await db.trip.findUnique({
    where: { slug },
    include: { participants: { include: { payment: true } } },
  });
  if (!trip || trip.adminToken !== parsed.data.adminToken) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const unpaid = trip.participants.filter((p) => p.payment && p.payment.status !== "paid");
  if (unpaid.length === 0) {
    return NextResponse.json({ error: "Everyone has paid" }, { status: 400 });
  }

  const amountDue = formatPence(unpaid[0].payment!.totalPence);
  const deadline = trip.responseDeadline
    ? trip.responseDeadline.toLocaleDateString("en-GB", { day: "numeric", month: "long" })
    : null;

  const message = await draftReminderMessage(
    trip.title,
    unpaid.map((p) => p.name),
    amountDue,
    deadline
  );

  const channel = getNotificationChannel();
  await Promise.all(
    unpaid.map((p) => channel.send({ tripId: trip.id, participantId: p.id, message }))
  );

  return NextResponse.json({ ok: true, message, remindedCount: unpaid.length });
}
