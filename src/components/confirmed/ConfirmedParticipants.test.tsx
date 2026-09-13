import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfirmedParticipants } from "@/components/confirmed/ConfirmedParticipants";

const participants = [
  { id: "p1", userId: "u1", name: "Ella Oakes", isOrganizer: true, isAttending: true },
  { id: "p2", userId: "u2", name: "Sam", isOrganizer: false, isAttending: true },
  { id: "p3", userId: "u3", name: "Priya Patel", isOrganizer: false, isAttending: false },
];

describe("ConfirmedParticipants", () => {
  it("lists everyone on the trip, not only those attending", () => {
    render(<ConfirmedParticipants participants={participants} />);

    expect(screen.getByText(/Ella Oakes/)).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("Priya Patel")).toBeInTheDocument();
  });

  it("counts only those whose dates work", () => {
    render(<ConfirmedParticipants participants={participants} />);

    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });

  it("marks the organizer", () => {
    render(<ConfirmedParticipants participants={participants} />);

    expect(screen.getByText(/Organizer/)).toBeInTheDocument();
  });

  it("says plainly when someone's dates don't work", () => {
    render(<ConfirmedParticipants participants={participants} />);

    expect(screen.getByText("Dates don't work")).toBeInTheDocument();
  });

  it("builds initials from one-word and two-word names", () => {
    render(<ConfirmedParticipants participants={participants} />);

    expect(screen.getByText("EO")).toBeInTheDocument();
    expect(screen.getByText("SA")).toBeInTheDocument();
    expect(screen.getByText("PP")).toBeInTheDocument();
  });
});
