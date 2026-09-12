"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function JoinTripForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trips/${slug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Couldn't join — check the link and try again.");
      const data = await res.json();
      router.push(`/p/${data.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-md text-left">
      <div className="mb-6">
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          className="input"
          placeholder="Jamie"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
        />
      </div>
      {error && <p className="mb-4 text-sm text-coral-dark">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "Joining…" : "Join trip"}
      </button>
    </form>
  );
}
