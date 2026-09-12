"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function GlobalError({
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
      <h1 className="text-xl font-semibold text-teal-950">
        Something went wrong
      </h1>
      <p className="text-sm text-teal-950/70">
        Sorry about that — please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </Container>
  );
}
