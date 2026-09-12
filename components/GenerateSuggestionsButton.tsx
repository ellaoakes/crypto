"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateSuggestionsButton({ slug, adminToken }: { slug: string; adminToken: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trips/${slug}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error === "No responses yet" ? "Wait for at least one answer first." : "Couldn't generate suggestions.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button className="btn-primary" onClick={handleClick} disabled={submitting}>
        {submitting ? "Thinking…" : "Generate suggestions"}
      </button>
      {error && <p className="mt-2 text-sm text-coral-dark">{error}</p>}
    </div>
  );
}
