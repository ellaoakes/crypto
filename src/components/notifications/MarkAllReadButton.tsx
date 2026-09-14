"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markAllReadAction } from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/Button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      isLoading={isPending}
      onClick={() =>
        startTransition(async () => {
          await markAllReadAction();
          router.refresh();
        })
      }
    >
      Mark all as read
    </Button>
  );
}
