"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemindButton({ slug, adminToken }: { slug: string; adminToken: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setError(null);
    setSentMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trips/${slug}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminToken }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error === "Everyone has paid" ? "Everyone's already paid — nothing to chase." : "Couldn't send reminders.");
      setSentMessage(body.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button className="btn-ghost" onClick={handleClick} disabled={submitting}>
        {submitting ? "Sending…" : "Send reminder to unpaid"}
      </button>
      {error && <p className="mt-2 text-sm text-coral-dark">{error}</p>}
      {sentMessage && (
        <div className="mt-3 rounded-xl bg-cream-dark p-3 text-sm">
          <p className="mb-1 font-semibold">Sent:</p>
          <p className="text-navy-soft">&ldquo;{sentMessage}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
