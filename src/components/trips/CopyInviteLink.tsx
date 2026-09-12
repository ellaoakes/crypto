"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

export function CopyInviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (older browser, insecure context) — the
      // link text below is still visible and selectable by hand.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="break-all rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">
        {url}
      </p>
      <Button type="button" variant="secondary" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy invite link"}
      </Button>
      <span role="status" className="sr-only">
        {copied ? "Invite link copied to clipboard" : ""}
      </span>
    </div>
  );
}
