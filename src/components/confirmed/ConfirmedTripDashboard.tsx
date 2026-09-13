import Link from "next/link";

import {
  ConfirmedParticipants,
  type ConfirmedParticipant,
} from "@/components/confirmed/ConfirmedParticipants";
import { ConfirmedHero } from "@/components/confirmed/ConfirmedHero";
import { ReopenTripButton } from "@/components/confirmed/ReopenTripButton";
import { TRIP_SECTIONS, TripSectionCard } from "@/components/confirmed/TripSectionCard";
import { Card } from "@/components/ui/Card";
import type { ConfirmedTrip } from "@/lib/confirmedTrip";

/**
 * The home of a confirmed trip, and the surface every later feature hangs
 * off: the celebration up top, who's going, then one section per planning
 * area still to be built.
 */
export function ConfirmedTripDashboard({
  tripId,
  tripName,
  confirmed,
  participants,
  isOrganizer,
}: {
  tripId: string;
  tripName: string;
  confirmed: ConfirmedTrip;
  participants: ConfirmedParticipant[];
  isOrganizer: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ConfirmedHero trip={confirmed} />

      <div className="flex flex-col gap-1 text-center">
        <h2 className="font-medium text-teal-950">{tripName}</h2>
        <p className="text-sm text-teal-950/60">
          Confirmed by the group ·{" "}
          <Link href={`/trips/${tripId}/discover/${confirmed.destination.id}`} className="text-teal-700 hover:underline">
            Why {confirmed.destination.name}?
          </Link>
        </p>
      </div>

      <ConfirmedParticipants participants={participants} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-medium text-teal-950">Plan the trip</h2>
          <p className="text-sm text-teal-950/60">
            Nothing here is booked yet — these are the next things to sort out.
          </p>
        </div>
        {TRIP_SECTIONS.map((section) => (
          <TripSectionCard
            key={section.title}
            icon={section.icon}
            title={section.title}
            description={section.description}
          />
        ))}
      </section>

      {isOrganizer ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-medium text-teal-950">Organizer</h2>
          <p className="text-sm text-teal-950/60">
            Something changed? Reopening clears the confirmed destination and dates and puts
            it back to the group.
          </p>
          <ReopenTripButton tripId={tripId} />
        </Card>
      ) : (
        <p className="text-center text-sm text-teal-950/50">
          Only the organizer can reopen this trip for changes.
        </p>
      )}
    </div>
  );
}
