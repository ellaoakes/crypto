import { Card } from "@/components/ui/Card";

/**
 * A placeholder for one of the confirmed trip's planning areas. These are
 * deliberately inert: the trip is confirmed, but nothing is booked, and the
 * card says so rather than implying a feature that doesn't exist yet.
 */
export function TripSectionCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Card className="flex items-start gap-3">
      <span aria-hidden="true" className="text-2xl leading-none">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-teal-950">{title}</h3>
          <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-teal-700">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-teal-950/60">{description}</p>
      </div>
    </Card>
  );
}

/**
 * The areas the confirmed trip will grow into, in the order they'll be used.
 * Payments has its own section on the dashboard and is deliberately not here.
 */
export const TRIP_SECTIONS = [
  {
    icon: "✈️",
    title: "Flights",
    description: "Find and compare flights from everyone's departure airports.",
  },
  {
    icon: "🏨",
    title: "Accommodation",
    description: "Somewhere for the whole group to stay, split however you like.",
  },
  {
    icon: "🍸",
    title: "Activities",
    description: "Book the things everyone voted for, together.",
  },
  {
    icon: "🍝",
    title: "Restaurants",
    description: "Save the places you want to eat and reserve tables.",
  },
  {
    icon: "🗓",
    title: "Itinerary",
    description: "A shared day-by-day plan everyone can add to.",
  },
] as const;
