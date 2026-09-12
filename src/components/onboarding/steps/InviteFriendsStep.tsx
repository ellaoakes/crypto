"use client";

import { useState } from "react";

import { StepHeading } from "@/components/onboarding/StepHeading";
import { Button } from "@/components/ui/Button";

export function InviteFriendsStep({
  tripName,
  inviteUrl,
  onContinue,
}: {
  tripName: string;
  inviteUrl: string;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareMessage = `Join "${tripName}" and add your dates and budget: ${inviteUrl}`;

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${tripName}`,
          text: `Join "${tripName}" and add your dates and budget.`,
          url: inviteUrl,
        });
        return;
      } catch {
        // User cancelled the native share sheet — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the link text is still visible and selectable.
    }
  }

  return (
    <>
      <StepHeading
        eyebrow="Step 3 of 7"
        title="Invite your friends"
        subtitle="Anyone with this link can join instantly — no app or account setup needed to preview it."
      />
      <div className="flex flex-1 flex-col gap-4">
        <div className="rounded-2xl bg-white p-5 text-center shadow-lg">
          <p className="text-sm text-teal-950/60">Your invite link</p>
          <p className="mt-2 break-all rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900">
            {inviteUrl}
          </p>
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={handleShare}
          >
            {copied ? "Copied!" : "Share invite link"}
          </Button>
          <span role="status" className="sr-only">
            {copied ? "Invite link copied to clipboard" : ""}
          </span>
        </div>

        <div className="flex justify-center gap-6">
          <QuickShareLink
            href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
            emoji="💬"
            label="WhatsApp"
          />
          <QuickShareLink
            href={`sms:?&body=${encodeURIComponent(shareMessage)}`}
            emoji="📱"
            label="Message"
          />
          <QuickShareLink
            href={`mailto:?subject=${encodeURIComponent(`Join ${tripName}`)}&body=${encodeURIComponent(shareMessage)}`}
            emoji="✉️"
            label="Email"
          />
        </div>
      </div>
      <div className="pt-6">
        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          onClick={onContinue}
        >
          Continue
        </Button>
      </div>
    </>
  );
}

function QuickShareLink({
  href,
  emoji,
  label,
}: {
  href: string;
  emoji: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-1.5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-600 rounded-xl px-2 py-1"
    >
      <span
        className="flex size-14 items-center justify-center rounded-full bg-white/20 text-2xl"
        aria-hidden="true"
      >
        {emoji}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </a>
  );
}
