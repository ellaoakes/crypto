import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/Input";

describe("Input", () => {
  it("associates the label with the input", () => {
    render(<Input label="Email address" name="email" />);

    const input = screen.getByLabelText("Email address");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("name", "email");
  });

  it("shows an accessible error message linked via aria-describedby", () => {
    render(
      <Input label="Trip name" name="name" error="Trip name is required" />,
    );

    const input = screen.getByLabelText("Trip name");
    const error = screen.getByRole("alert");

    expect(error).toHaveTextContent("Trip name is required");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(error.id);
  });

  it("shows a hint when provided and no error is present", () => {
    render(<Input label="Budget" name="budget" hint="Per person, in GBP" />);

    expect(screen.getByText("Per person, in GBP")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
