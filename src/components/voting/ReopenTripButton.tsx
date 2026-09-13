"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { reopenTripAction } from "@/app/(app)/trips/[tripId]/vote/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function ReopenTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReopen() {
    setError(null);
    startTransition(async () => {
      const result = await reopenTripAction(tripId);
      setOpen(false);

      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button type="button" variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        Reopen for changes
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reopen this trip?"
        description="The confirmed destination and dates will be cleared, and everyone can vote again."
      >
        <Button type="button" isLoading={isPending} className="w-full" onClick={handleReopen}>
          Yes, reopen it
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </Modal>
    </div>
  );
}
