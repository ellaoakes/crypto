import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { SuggestedOption } from "@/lib/types";
import { generatePaymentReference } from "@/lib/tokens";
import { PROCESSING_FEE_PENCE } from "@/lib/payments";

const schema = z.object({ adminToken: z.string(), suggestionId: z.string(), optionIndex: z.number().int().min(0) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const trip = await db.trip.findUnique({ where: { slug }, include: { participants: true } });
  if (!trip || trip.adminToken !== parsed.data.adminToken) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const suggestion = await db.suggestion.findUnique({ where: { id: parsed.data.suggestionId } });
  if (!suggestion || suggestion.tripId !== trip.id) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  const options: SuggestedOption[] = JSON.parse(suggestion.optionsJson);
  const option = options[parsed.data.optionIndex];
  if (!option) {
    return NextResponse.json({ error: "Option not found" }, { status: 404 });
  }

  const contributionPence = option.estimatedCostPerHeadPence;
  const feePence = trip.processingFeePence || PROCESSING_FEE_PENCE;
  const totalPence = contributionPence + feePence;

  await db.$transaction([
    db.trip.update({
      where: { id: trip.id },
      data: {
        status: "collecting_deposits",
        chosenSuggestionId: suggestion.id,
        chosenOptionIndex: parsed.data.optionIndex,
        depositAmountPence: contributionPence,
      },
    }),
    ...trip.participants.map((p) =>
      db.payment.upsert({
        where: { participantId: p.id },
        create: {
          participantId: p.id,
          contributionPence,
          feePence,
          totalPence,
          reference: generatePaymentReference(),
        },
        update: {
          contributionPence,
          feePence,
          totalPence,
        },
      })
    ),
  ]);

  return NextResponse.json({ ok: true, option });
}
