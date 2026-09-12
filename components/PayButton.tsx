"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PayButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePay() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/participants/${token}/pay`, { method: "POST" });
      if (!res.ok) throw new Error("Payment didn't go through — try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button className="btn-primary w-full" onClick={handlePay} disabled={submitting}>
        {submitting ? "Confirming…" : "Confirm payment"}
      </button>
      {error && <p className="mt-3 text-sm text-coral-dark">{error}</p>}
    </div>
  );
}
