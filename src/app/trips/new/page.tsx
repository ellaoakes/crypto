import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CreateTripForm } from "@/components/trips/CreateTripForm";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export default async function NewTripPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=/trips/new");
  }

  return (
    <Container className="flex flex-1 flex-col justify-center gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-teal-950">Start a trip</h1>
        <p className="text-sm text-teal-950/70">
          You&apos;ll get a link to share with friends right after.
        </p>
      </div>
      <Card>
        <CreateTripForm />
      </Card>
    </Container>
  );
}
