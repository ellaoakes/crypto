import Anthropic from "@anthropic-ai/sdk";
import type { ResponseInput, SuggestedOption } from "./types";
import { formatPence } from "./money";

const MODEL = "claude-sonnet-5";

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

/**
 * Reconciles everyone's private answers (date exclusions, budget ceiling,
 * destination preference) into 2-3 concrete trip options. This is the one
 * genuinely AI-shaped job in the product — the rest is ordinary software —
 * so when no API key is configured we fall back to a deterministic
 * heuristic rather than leaving the feature broken.
 */
export async function generateSuggestions(
  tripTitle: string,
  responses: ResponseInput[]
): Promise<{ options: SuggestedOption[]; generatedBy: "ai" | "heuristic" }> {
  const client = getClient();
  if (client) {
    try {
      const options = await generateWithClaude(client, tripTitle, responses);
      if (options.length > 0) {
        return { options, generatedBy: "ai" };
      }
    } catch (err) {
      console.error("Claude suggestion generation failed, falling back to heuristic:", err);
    }
  }
  return { options: generateHeuristic(responses), generatedBy: "heuristic" };
}

async function generateWithClaude(
  client: Anthropic,
  tripTitle: string,
  responses: ResponseInput[]
): Promise<SuggestedOption[]> {
  const prompt = `You are helping reconcile a UK group trip called "${tripTitle}" into concrete options.

Each participant privately answered three questions. Here are all the responses:

${responses
  .map(
    (r, i) =>
      `${i + 1}. ${r.participantName}
   - Can't do: ${r.unavailableDates || "no exclusions given"}
   - Budget ceiling: ${formatPence(r.budgetPence)}
   - Destination preference: ${r.destinationPreference || "no preference given"}${
        r.notes ? `\n   - Notes: ${r.notes}` : ""
      }`
  )
  .join("\n\n")}

Produce 2-3 concrete trip options that best satisfy the group. Rules:
- Every option's estimated cost per head must not exceed the LOWEST budget ceiling stated above, so nobody is quietly priced out.
- Prefer destinations/date ranges multiple people mentioned or that avoid the most stated exclusions.
- Be concrete: a real destination, a real-sounding date range (this trip is upcoming, assume the current UK wedding season if relevant), and a realistic per-head cost estimate in GBP pence for UK travel.
- The rationale should be one or two plain-English sentences a group chat would actually understand, referencing the real constraints (e.g. who it avoids clashing with, whose budget it respects).

Respond with ONLY a JSON array (no markdown fences, no prose) of 2-3 objects shaped exactly like:
[{"destination": string, "dateRange": string, "estimatedCostPerHeadPence": number, "rationale": string}]`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const jsonText = extractJsonArray(textBlock.text);
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(
      (o): o is SuggestedOption =>
        typeof o?.destination === "string" &&
        typeof o?.dateRange === "string" &&
        typeof o?.estimatedCostPerHeadPence === "number" &&
        typeof o?.rationale === "string"
    )
    .slice(0, 3);
}

function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return "[]";
  return text.slice(start, end + 1);
}

/** Deterministic fallback used when no ANTHROPIC_API_KEY is configured. */
function generateHeuristic(responses: ResponseInput[]): SuggestedOption[] {
  if (responses.length === 0) return [];

  const lowestBudget = Math.min(...responses.map((r) => r.budgetPence));
  const perHeadCeiling = Math.round(lowestBudget * 0.9); // leave headroom below the tightest budget

  const destinationCounts = new Map<string, number>();
  for (const r of responses) {
    const dest = normaliseDestination(r.destinationPreference);
    if (!dest) continue;
    destinationCounts.set(dest, (destinationCounts.get(dest) ?? 0) + 1);
  }

  const rankedDestinations = [...destinationCounts.entries()].sort((a, b) => b[1] - a[1]);

  const fallbackDestinations = ["Manchester", "Liverpool", "Newcastle"];
  const chosen =
    rankedDestinations.length > 0
      ? rankedDestinations.slice(0, 3).map(([name]) => name)
      : fallbackDestinations;

  const exclusionNote = responses
    .map((r) => r.unavailableDates)
    .filter(Boolean)
    .join("; ");

  return chosen.slice(0, 3).map((destination, i) => {
    const mentionedBy = rankedDestinations.find(([name]) => name === destination)?.[1] ?? 0;
    return {
      destination,
      dateRange:
        exclusionNote.length > 0
          ? "To be confirmed — check against everyone's noted exclusions before booking"
          : "Any weekend works so far — no exclusions noted yet",
      estimatedCostPerHeadPence: perHeadCeiling - i * 500,
      rationale:
        mentionedBy > 1
          ? `${mentionedBy} of ${responses.length} people mentioned ${destination}, and this fits under the tightest stated budget of ${formatPence(
              lowestBudget
            )}.`
          : `Fits under the tightest stated budget of ${formatPence(
              lowestBudget
            )} so nobody is priced out. Add an ANTHROPIC_API_KEY to get smarter, date-aware suggestions.`,
    };
  });
}

function normaliseDestination(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // Take the first clause so "Amsterdam, or maybe Prague" contributes "Amsterdam".
  const first = trimmed.split(/[,.;\n]/)[0].trim();
  if (!first) return null;
  return first
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Drafts the "awkward message" nudging unpaid participants — one of the
 * three narrow AI jobs called out in the business plan. Falls back to a
 * plain template when no API key is configured.
 */
export async function draftReminderMessage(
  tripTitle: string,
  unpaidNames: string[],
  amountDue: string,
  deadline?: string | null
): Promise<string> {
  const client = getClient();
  if (client) {
    try {
      const prompt = `Write a short, friendly but clear group-chat message chasing unpaid deposits for a trip called "${tripTitle}".
Unpaid people: ${unpaidNames.join(", ")}.
Amount each of them owes: ${amountDue}.
${deadline ? `Deadline: ${deadline}.` : ""}
Keep it under 40 words, casual UK tone, no guilt-tripping, one clear call to action. Return only the message text, nothing else.`;
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = message.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text" && textBlock.text.trim()) {
        return textBlock.text.trim();
      }
    } catch (err) {
      console.error("Claude reminder drafting failed, falling back to template:", err);
    }
  }

  const names = unpaidNames.join(", ");
  const deadlineText = deadline ? ` by ${deadline}` : "";
  return `Friendly nudge for ${tripTitle}! ${names} — your ${amountDue} deposit is still outstanding${deadlineText}. Pop it in via your personal link whenever suits. 🙏`;
}
