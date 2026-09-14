"use client";

import { useState, useTransition } from "react";

import { setPreferenceAction } from "@/app/(app)/settings/notifications/actions";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { NotificationCategory } from "@/lib/notifications/events";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CHANNELS,
  CHANNEL_LABELS,
  type Channel,
} from "@/lib/notifications/preferences";

type Grid = Record<NotificationCategory, Record<Channel, boolean>>;

/**
 * What arrives, and where. Each channel says whether it can actually deliver
 * yet — a switch that promises email when no provider exists would be a lie,
 * so the unavailable ones say so rather than quietly doing nothing.
 */
export function PreferenceGrid({
  initial,
  channelAvailability,
}: {
  initial: Grid;
  channelAvailability: Record<Channel, boolean>;
}) {
  const [grid, setGrid] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(category: NotificationCategory, channel: Channel) {
    const next = !grid[category][channel];
    setGrid((current) => ({
      ...current,
      [category]: { ...current[category], [channel]: next },
    }));
    setError(null);

    startTransition(async () => {
      const result = await setPreferenceAction(category, channel, next);
      if (result.error) {
        // Put it back: the server is the one that decides.
        setGrid((current) => ({
          ...current,
          [category]: { ...current[category], [channel]: !next },
        }));
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {CATEGORIES.map((category) => (
        <Card key={category} className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-medium text-teal-950">{CATEGORY_LABELS[category].title}</h2>
            <p className="text-sm text-teal-950/60">{CATEGORY_LABELS[category].description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((channel) => {
              const on = grid[category][channel];
              const available = channelAvailability[channel];

              return (
                <button
                  key={channel}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${CATEGORY_LABELS[category].title} — ${CHANNEL_LABELS[channel]}`}
                  onClick={() => toggle(category, channel)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                    on
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-teal-200 bg-white text-teal-900 hover:bg-teal-50",
                  )}
                >
                  <span aria-hidden="true">{on ? "✓" : "○"}</span>
                  {CHANNEL_LABELS[channel]}
                  {!available ? (
                    <span className={cn("text-xs", on ? "text-white/70" : "text-teal-950/50")}>
                      (soon)
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      <p className="text-sm text-teal-950/60">
        Channels marked &ldquo;soon&rdquo; aren&apos;t sending yet. Your choice is saved and will
        apply the moment they do.
      </p>
    </div>
  );
}
