"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinByCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      className="mx-auto mt-4 flex max-w-sm gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim().toLowerCase();
        if (trimmed) router.push(`/t/${trimmed}/join`);
      }}
    >
      <input
        className="input"
        placeholder="Got a trip code? e.g. kx7p4qde"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-label="Trip code"
      />
      <button type="submit" className="btn-ghost whitespace-nowrap">
        Go →
      </button>
    </form>
  );
}
