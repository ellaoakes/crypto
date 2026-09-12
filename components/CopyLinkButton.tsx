"use client";

import { useState } from "react";

export function CopyLinkButton({ link, label }: { link: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="btn-ghost !py-2.5 !px-4 !text-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard API can be unavailable (e.g. insecure context) — the
          // link is still visible in the page for the organiser to select.
        }
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
