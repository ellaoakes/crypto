"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { joinTripAction, type JoinTripActionState } from "@/app/(app)/join/[code]/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

const initialState: JoinTripActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending}>
      Join trip
    </Button>
  );
}

export function JoinTripForm({ inviteCode }: { inviteCode: string }) {
  const [state, formAction] = useActionState(joinTripAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="inviteCode" value={inviteCode} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <SubmitButton />
    </form>
  );
}
