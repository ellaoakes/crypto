"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function CreateTripForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [organiserName, setOrganiserName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          organiserName,
          responseDeadline: deadline ? new Date(deadline).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ? "Please check the form and try again." : "Something went wrong.");
      }
      const data = await res.json();
      router.push(`/t/${data.slug}/admin/${data.adminToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-md text-left">
      <div className="mb-5">
        <label className="label" htmlFor="title">
          What&rsquo;s the trip?
        </label>
        <input
          id="title"
          className="input"
          placeholder="Dan's stag do"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
        />
      </div>
      <div className="mb-5">
        <label className="label" htmlFor="organiserName">
          Your name
        </label>
        <input
          id="organiserName"
          className="input"
          placeholder="Alex"
          value={organiserName}
          onChange={(e) => setOrganiserName(e.target.value)}
          required
          maxLength={80}
        />
      </div>
      <div className="mb-6">
        <label className="label" htmlFor="deadline">
          Deadline to answer &amp; vote (optional)
        </label>
        <input
          id="deadline"
          type="date"
          className="input"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      {error && <p className="mb-4 text-sm text-coral-dark">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "Creating…" : "Create trip"}
      </button>
    </form>
  );
}
