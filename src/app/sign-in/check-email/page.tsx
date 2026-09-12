import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export default function CheckEmailPage() {
  return (
    <Container className="flex flex-1 flex-col justify-center gap-6 text-center">
      <Card>
        <h1 className="text-xl font-semibold text-teal-950">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-teal-950/70">
          We&apos;ve sent you a sign-in link. Open it on this device to
          continue.
        </p>
      </Card>
    </Container>
  );
}
