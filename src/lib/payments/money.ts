/**
 * Money for the payment ledger.
 *
 * Every amount in this module — and in the database — is an integer in the
 * currency's minor unit (pence for GBP). Floats never touch money: £0.10 +
 * £0.20 is 10 + 20, not 0.1 + 0.2.
 *
 * Pure: no Prisma, no Stripe, no environment. See PAYMENTS.md.
 */

/** Our one-time fee, charged once per participant per trip. */
export const PLATFORM_FEE_MINOR = 500;

export class MoneyError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MoneyError";
    this.code = code;
  }
}

/** "£1,200.00" — display only; never round-trip this back into a calculation. */
export function formatMinor(amountMinor: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/** "£1,200" when the amount is whole, "£1,200.50" when it isn't. */
export function formatMinorCompact(amountMinor: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

/** Parses "1200", "1,200", "1200.50" or "£1,200.50" into minor units. */
export function parseMajorToMinor(input: string): number {
  const cleaned = input.trim().replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new MoneyError("INVALID_AMOUNT", "Enter an amount like 1200 or 1200.50.");
  }
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
