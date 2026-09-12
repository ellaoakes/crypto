import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { poundsToPence } from "@/lib/money";

const responseSchema = z.object({
  unavailableDates: z.string().trim().max(500),
  budgetPounds: z.number().positive().max(100000),
  destinationPreference: z.string().trim().max(300),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const participant = await db.participant.findUnique({ where: { token }, include: { response: true } });
  if (!participant) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }
  if (participant.response) {
    return NextResponse.json({ error: "Response already submitted" }, { status: 409 });
  }

  const { unavailableDates, budgetPounds, destinationPreference, notes } = parsed.data;

  await db.response.create({
    data: {
      participantId: participant.id,
      unavailableDates,
      budgetPence: poundsToPence(budgetPounds),
      destinationPreference,
      notes: notes || null,
    },
  });

  return NextResponse.json({ ok: true });
}
