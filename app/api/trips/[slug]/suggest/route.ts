import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateSuggestions } from "@/lib/ai";
import type { ResponseInput } from "@/lib/types";

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
    include: { participants: { include: { response: true } } },
  });
  if (!trip || trip.adminToken !== parsed.data.adminToken) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const responses: ResponseInput[] = trip.participants
    .filter((p) => p.response)
    .map((p) => ({
      participantName: p.name,
      unavailableDates: p.response!.unavailableDates,
      budgetPence: p.response!.budgetPence,
      destinationPreference: p.response!.destinationPreference,
      notes: p.response!.notes,
    }));

  if (responses.length === 0) {
    return NextResponse.json({ error: "No responses yet" }, { status: 400 });
  }

  const { options, generatedBy } = await generateSuggestions(trip.title, responses);

  const suggestion = await db.suggestion.create({
    data: {
      tripId: trip.id,
      optionsJson: JSON.stringify(options),
      generatedBy,
    },
  });

  if (trip.status === "collecting_responses") {
    await db.trip.update({ where: { id: trip.id }, data: { status: "suggestions_ready" } });
  }

  return NextResponse.json({ id: suggestion.id, options, generatedBy });
}
