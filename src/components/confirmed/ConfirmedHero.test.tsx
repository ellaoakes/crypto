import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfirmedHero } from "@/components/confirmed/ConfirmedHero";
import { toConfirmedTrip } from "@/lib/confirmedTrip";

function build(overrides: Partial<Parameters<typeof toConfirmedTrip>[0]> = {}) {
  const confirmed = toConfirmedTrip({
    status: "CONFIRMED",
    confirmedDestinationId: "marbella-spain",
    confirmedDateStart: new Date("2027-05-14T00:00:00Z"),
    confirmedDateEnd: new Date("2027-05-17T00:00:00Z"),
    confirmedAt: new Date("2026-09-13T10:00:00Z"),
    confirmedCostMin: 700,
    confirmedCostMax: 850,
    confirmedAttendingUserIds: ["a", "b", "c", "d", "e", "f"],
    ...overrides,
  });
  if (!confirmed) throw new Error("expected a confirmed trip");
  return confirmed;
}

describe("ConfirmedHero", () => {
  it("celebrates the decision with the confirmed destination and dates", () => {
    render(<ConfirmedHero trip={build()} />);

    expect(screen.getByText(/It's happening/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marbella" })).toBeInTheDocument();
    expect(screen.getByText("Spain")).toBeInTheDocument();
    expect(screen.getByText("14–17 May 2027")).toBeInTheDocument();
  });

  it("shows the headcount, nights and estimated cost from the snapshot", () => {
    render(<ConfirmedHero trip={build()} />);

    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("people")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("nights")).toBeInTheDocument();
    expect(screen.getByText("£700–£850")).toBeInTheDocument();
  });

  it("uses singular wording for a solo, one-night trip", () => {
    render(
      <ConfirmedHero
        trip={build({
          confirmedDateEnd: new Date("2027-05-15T00:00:00Z"),
          confirmedAttendingUserIds: ["a"],
        })}
      />,
    );

    expect(screen.getByText("person")).toBeInTheDocument();
    expect(screen.getByText("night")).toBeInTheDocument();
  });

  it("omits the cost stat entirely when none was snapshotted", () => {
    render(<ConfirmedHero trip={build({ confirmedCostMin: null, confirmedCostMax: null })} />);

    expect(screen.queryByText("est. pp")).not.toBeInTheDocument();
  });
});
