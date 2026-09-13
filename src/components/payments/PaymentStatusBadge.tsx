import { cn } from "@/lib/cn";

const LABELS: Record<string, string> = {
  NO_PAYMENT: "Not started",
  INITIAL_PAYMENT_PENDING: "Payment in progress",
  INITIAL_PAYMENT_PAID: "Deposit paid",
  PARTIALLY_PAID: "Part paid",
  FULLY_PAID: "Paid in full",
  PAYMENT_FAILED: "Payment failed",
  PAYMENT_OVERDUE: "Overdue",
  REFUND_PENDING: "Refund pending",
  PARTIALLY_REFUNDED: "Partly refunded",
  REFUNDED: "Refunded",
};

const TONES: Record<string, string> = {
  NO_PAYMENT: "bg-teal-50 text-teal-700",
  INITIAL_PAYMENT_PENDING: "bg-sky-50 text-sky-700",
  INITIAL_PAYMENT_PAID: "bg-emerald-50 text-emerald-700",
  PARTIALLY_PAID: "bg-emerald-50 text-emerald-700",
  FULLY_PAID: "bg-emerald-600 text-white",
  PAYMENT_FAILED: "bg-red-50 text-red-700",
  PAYMENT_OVERDUE: "bg-amber-50 text-amber-800",
  REFUND_PENDING: "bg-sky-50 text-sky-700",
  PARTIALLY_REFUNDED: "bg-amber-50 text-amber-800",
  REFUNDED: "bg-teal-50 text-teal-700",
};

export function PaymentStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONES[status] ?? TONES.NO_PAYMENT,
        className,
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}

export { LABELS as PAYMENT_STATUS_LABELS };
