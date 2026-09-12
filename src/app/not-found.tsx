import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold text-teal-950">Page not found</h1>
      <p className="text-sm text-teal-950/70">
        That page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link href="/">
        <Button variant="secondary">Go home</Button>
      </Link>
    </Container>
  );
}
