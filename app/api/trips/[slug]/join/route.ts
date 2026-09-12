import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateSecretToken } from "@/lib/tokens";

const joinSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const trip = await db.trip.findUnique({ where: { slug } });
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const participant = await db.participant.create({
    data: {
      tripId: trip.id,
      name: parsed.data.name,
      token: generateSecretToken(),
    },
  });

  return NextResponse.json({ token: participant.token });
}
