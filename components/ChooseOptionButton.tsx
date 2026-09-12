"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ChooseOptionButton({
  slug,
  adminToken,
  suggestionId,
  optionIndex,
}: {
  slug: string;
  adminToken: string;
  suggestionId: string;
  optionIndex: number;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${slug}/choose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminToken, suggestionId, optionIndex }),
      });
      if (!res.ok) throw new Error("Couldn't lock in that option.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button className="btn-primary w-full" onClick={handleClick} disabled={submitting}>
        {submitting ? "Locking in…" : "Choose this option"}
      </button>
      {error && <p className="mt-2 text-sm text-coral-dark">{error}</p>}
    </div>
  );
}
