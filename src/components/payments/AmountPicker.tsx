"use client";

import { useState } from "react";

import { PayButton } from "@/components/payments/PayButton";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { MoneyError, formatMinor, formatMinorCompact, parseMajorToMinor } from "@/lib/payments/money";

const PRESETS_MINOR = [5_000, 10_000, 20_000, 50_000];

/**
 * Choosing how much to pay towards the remaining balance.
 *
 * The figures below the choice are a preview, not an instruction: the server
 * recalculates the trip money and the fee before charging anything, and
 * refuses anything over the balance regardless of what arrives from here.
 */
export function AmountPicker({
  tripId,
  currency,
  remainingBalance,
}: {
  tripId: string;
  currency: string;
  remainingBalance: number;
}) {
  const [selected, setSelected] = useState<number | "custom" | null>(null);
  const [customInput, setCustomInput] = useState("");

  // A preset bigger than what's left would only ever be refused, so it isn't
  // offered. Paying the balance off exactly always is.
  const presets = PRESETS_MINOR.filter((amount) => amount < remainingBalance);

  let amountMinor: number | null = null;
  let customError: string | null = null;

  if (selected === "custom") {
    if (customInput.trim() !== "") {
      try {
        const parsed = parseMajorToMinor(customInput);
        if (parsed <= 0) {
          customError = "Enter an amount greater than zero.";
        } else if (parsed > remainingBalance) {
          customError = `That's more than your remaining balance of ${formatMinorCompact(remainingBalance, currency)}.`;
        } else {
          amountMinor = parsed;
        }
      } catch (error) {
        customError = error instanceof MoneyError ? error.message : "Enter a valid amount.";
      }
    }
  } else if (typeof selected === "number") {
    amountMinor = selected;
  }

  const options: { key: string; label: string; value: number | "custom" }[] = [
    ...presets.map((amount) => ({
      key: String(amount),
      label: formatMinorCompact(amount, currency),
      value: amount as number | "custom",
    })),
    {
      key: "full",
      label: `Pay it off (${formatMinorCompact(remainingBalance, currency)})`,
      value: remainingBalance as number | "custom",
    },
    { key: "custom", label: "Custom amount", value: "custom" as const },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1">
        <p className="text-sm text-teal-950/60">Remaining balance</p>
        <p className="text-3xl font-bold text-teal-950">
          {formatMinor(remainingBalance, currency)}
        </p>
      </Card>

      <fieldset className="flex flex-col gap-3">
        <legend className="pb-2 font-medium text-teal-950">
          How much would you like to pay?
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {options.map((option) => {
            const isSelected =
              option.value === "custom" ? selected === "custom" : selected === option.value;

            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelected(option.value)}
                className={cn(
                  "flex h-14 items-center justify-center rounded-xl border-2 px-3 text-sm font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                  option.key === "custom" || option.key === "full" ? "col-span-2" : "",
                  isSelected
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-teal-200 bg-white text-teal-900 hover:bg-teal-50",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {selected === "custom" ? (
          <Input
            label="Custom amount"
            name="customAmount"
            inputMode="decimal"
            autoFocus
            value={customInput}
            onChange={(event) => setCustomInput(event.target.value)}
            error={customError ?? undefined}
            hint={`Anything up to ${formatMinorCompact(remainingBalance, currency)}.`}
          />
        ) : null}
      </fieldset>

      {amountMinor !== null ? (
        <Card className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-teal-950/70">Trip payment</span>
            <span className="text-sm font-medium text-teal-950">
              {formatMinor(amountMinor, currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-teal-950/70">Platform fee</span>
            <span className="text-sm font-medium text-teal-950">
              {formatMinor(0, currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-teal-200 pt-2">
            <span className="text-sm font-bold uppercase tracking-wide text-teal-950">Total</span>
            <span className="text-xl font-bold text-teal-950">
              {formatMinor(amountMinor, currency)}
            </span>
          </div>
        </Card>
      ) : null}

      <PayButton
        tripId={tripId}
        label={amountMinor === null ? "Choose an amount" : `Pay ${formatMinor(amountMinor, currency)}`}
        amountInput={amountMinor === null ? undefined : String(amountMinor / 100)}
        disabled={amountMinor === null}
      />
    </div>
  );
}
