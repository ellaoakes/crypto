import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders the title and optional description and action", () => {
    render(
      <EmptyState
        title="No trips yet"
        description="Start one and invite your friends."
        action={<button>Create trip</button>}
      />,
    );

    expect(screen.getByText("No trips yet")).toBeInTheDocument();
    expect(
      screen.getByText("Start one and invite your friends."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create trip" })).toBeInTheDocument();
  });

  it("renders without a description or action", () => {
    render(<EmptyState title="Nothing here" />);

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
