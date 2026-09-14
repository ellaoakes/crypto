import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaymentDeadlines } from "@/components/payments/PaymentDeadlines";

const NOW = new Date("2027-01-01T12:00:00Z");

describe("PaymentDeadlines", () => {
  it("renders nothing when the trip has no deadlines", () => {
    const { container } = render(
      <PaymentDeadlines paymentDeadline={null} finalPaymentDeadline={null} now={NOW} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a distant deadline plainly, with no countdown", () => {
    render(
      <PaymentDeadlines
        paymentDeadline={new Date("2027-06-01T00:00:00Z")}
        finalPaymentDeadline={null}
        now={NOW}
      />,
    );

    expect(screen.getByText("1 June 2027")).toBeInTheDocument();
  });

  it("counts down a deadline that's close", () => {
    render(
      <PaymentDeadlines
        paymentDeadline={new Date("2027-01-04T00:00:00Z")}
        finalPaymentDeadline={null}
        now={NOW}
      />,
    );

    expect(screen.getByText(/in 3 days/)).toBeInTheDocument();
  });

  it("says today on the day", () => {
    render(
      <PaymentDeadlines
        paymentDeadline={new Date("2027-01-01T23:00:00Z")}
        finalPaymentDeadline={null}
        now={NOW}
      />,
    );

    expect(screen.getByText(/today/)).toBeInTheDocument();
  });

  it("says how long ago a missed deadline was", () => {
    render(
      <PaymentDeadlines
        paymentDeadline={new Date("2026-12-25T00:00:00Z")}
        finalPaymentDeadline={null}
        now={NOW}
      />,
    );

    expect(screen.getByText(/7 days ago/)).toBeInTheDocument();
  });

  it("stops counting down once the obligation is met", () => {
    render(
      <PaymentDeadlines
        paymentDeadline={new Date("2026-12-25T00:00:00Z")}
        finalPaymentDeadline={null}
        initialPaymentPaid
        now={NOW}
      />,
    );

    expect(screen.getByText("25 December 2026")).toBeInTheDocument();
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
  });

  it("labels the two deadlines distinctly", () => {
    render(
      <PaymentDeadlines
        paymentDeadline={new Date("2027-02-01T00:00:00Z")}
        finalPaymentDeadline={new Date("2027-03-01T00:00:00Z")}
        now={NOW}
      />,
    );

    expect(screen.getByText("Initial payment due")).toBeInTheDocument();
    expect(screen.getByText("Balance due")).toBeInTheDocument();
  });
});
