"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function TripError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold text-teal-950">Couldn&apos;t load this trip</h1>
      <p className="text-sm text-teal-950/70">
        Something went wrong loading the trip. Your plans are safe — please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </Container>
  );
}
