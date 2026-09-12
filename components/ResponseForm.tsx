"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ResponseForm({ token }: { token: string }) {
  const router = useRouter();
  const [unavailableDates, setUnavailableDates] = useState("");
  const [budgetPounds, setBudgetPounds] = useState("");
  const [destinationPreference, setDestinationPreference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const budget = Number(budgetPounds);
    if (!budget || budget <= 0) {
      setError("Enter what you can realistically spend, in pounds.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/participants/${token}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unavailableDates,
          budgetPounds: budget,
          destinationPreference,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Something went wrong submitting your answers.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-lg text-left">
      <div className="mb-5">
        <label className="label" htmlFor="unavailableDates">
          Any dates you definitely can&rsquo;t do?
        </label>
        <input
          id="unavailableDates"
          className="input"
          placeholder="Can't do the weekend of the 14th, sister's thing"
          value={unavailableDates}
          onChange={(e) => setUnavailableDates(e.target.value)}
          maxLength={500}
        />
      </div>
      <div className="mb-5">
        <label className="label" htmlFor="budget">
          What can you realistically spend? (this stays private)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-navy-soft">£</span>
          <input
            id="budget"
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            className="input"
            placeholder="250"
            value={budgetPounds}
            onChange={(e) => setBudgetPounds(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="mb-5">
        <label className="label" htmlFor="destination">
          Where would you like to go?
        </label>
        <input
          id="destination"
          className="input"
          placeholder="Amsterdam, or somewhere with a beach"
          value={destinationPreference}
          onChange={(e) => setDestinationPreference(e.target.value)}
          maxLength={300}
        />
      </div>
      <div className="mb-6">
        <label className="label" htmlFor="notes">
          Anything else? (optional)
        </label>
        <input
          id="notes"
          className="input"
          placeholder="Happy to share a room, vegetarian, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
        />
      </div>
      {error && <p className="mb-4 text-sm text-coral-dark">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit my answers"}
      </button>
    </form>
  );
}
