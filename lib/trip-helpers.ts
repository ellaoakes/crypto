import { db } from "./db";
import type { SuggestedOption } from "./types";

export async function getChosenOption(trip: {
  chosenSuggestionId: string | null;
  chosenOptionIndex: number | null;
}): Promise<SuggestedOption | null> {
  if (!trip.chosenSuggestionId || trip.chosenOptionIndex === null) return null;
  const suggestion = await db.suggestion.findUnique({ where: { id: trip.chosenSuggestionId } });
  if (!suggestion) return null;
  const options: SuggestedOption[] = JSON.parse(suggestion.optionsJson);
  return options[trip.chosenOptionIndex] ?? null;
}

export function computeProgress(participants: { response: unknown; payment: { status: string } | null }[]) {
  const total = participants.length;
  const responded = participants.filter((p) => p.response).length;
  const withPayment = participants.filter((p) => p.payment);
  const paid = withPayment.filter((p) => p.payment!.status === "paid").length;

  return {
    total,
    responded,
    responsePercent: total > 0 ? Math.round((responded / total) * 100) : 0,
    paid,
    payable: withPayment.length,
    paidPercent: withPayment.length > 0 ? Math.round((paid / withPayment.length) * 100) : 0,
  };
}
