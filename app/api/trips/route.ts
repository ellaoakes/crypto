import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateSecretToken, generateSlug } from "@/lib/tokens";

const createTripSchema = z.object({
  title: z.string().trim().min(2).max(120),
  organiserName: z.string().trim().min(1).max(80),
  responseDeadline: z.string().datetime().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, organiserName, responseDeadline } = parsed.data;

  // Slugs are short and drawn from a small alphabet, so collisions are
  // possible (if rare) — retry a couple of times rather than surface it.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    try {
      const trip = await db.trip.create({
        data: {
          slug,
          title,
          organiserName,
          adminToken: generateSecretToken(),
          responseDeadline: responseDeadline ? new Date(responseDeadline) : null,
          participants: {
            create: {
              name: organiserName,
              isOrganiser: true,
              token: generateSecretToken(),
            },
          },
        },
        include: { participants: true },
      });

      return NextResponse.json({
        slug: trip.slug,
        adminToken: trip.adminToken,
        organiserParticipantToken: trip.participants[0].token,
      });
    } catch (err: unknown) {
      const isUniqueClash = typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
      if (!isUniqueClash) throw err;
    }
  }

  return NextResponse.json({ error: "Could not allocate a trip code, try again." }, { status: 500 });
}
