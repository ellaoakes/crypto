import { Card } from "@/components/ui/Card";

export interface ConfirmedParticipant {
  id: string;
  userId: string;
  name: string;
  isOrganizer: boolean;
  /** Their availability covered the confirmed dates when it was locked in. */
  isAttending: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ConfirmedParticipants({
  participants,
}: {
  participants: ConfirmedParticipant[];
}) {
  const attending = participants.filter((participant) => participant.isAttending).length;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium text-teal-950">Who&apos;s going</h2>
        <p className="text-sm text-teal-950/60">
          {attending} of {participants.length}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {participants.map((participant) => (
          <li key={participant.id} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={
                participant.isAttending
                  ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white"
                  : "flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700"
              }
            >
              {initials(participant.name)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-teal-950">
              {participant.name}
              {participant.isOrganizer ? (
                <span className="text-teal-950/50"> · Organizer</span>
              ) : null}
            </span>
            {participant.isAttending ? (
              <span className="shrink-0 text-sm text-emerald-700" title="Free for these dates">
                <span aria-hidden="true">✓</span>
                <span className="sr-only">Free for these dates</span>
              </span>
            ) : (
              <span className="shrink-0 text-xs text-amber-700">Dates don&apos;t work</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
