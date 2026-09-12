"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createTripAction, type CreateTripActionState } from "@/app/trips/new/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: CreateTripActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending}>
      Create trip
    </Button>
  );
}

export function CreateTripForm() {
  const [state, formAction] = useActionState(createTripAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input
        label="Trip name"
        name="name"
        placeholder="e.g. Someone's 30th"
        autoComplete="off"
        required
        error={state.error}
      />
      <SubmitButton />
    </form>
  );
}
