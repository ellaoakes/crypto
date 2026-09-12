import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInForm } from "@/components/auth/SignInForm";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const resolvedCallbackUrl = Array.isArray(callbackUrl)
    ? callbackUrl[0]
    : callbackUrl;

  if (session?.user) {
    redirect(resolvedCallbackUrl?.startsWith("/") ? resolvedCallbackUrl : "/");
  }

  return (
    <Container className="flex flex-1 flex-col justify-center gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold text-teal-950">Sign in</h1>
        <p className="text-sm text-teal-950/70">
          No password needed — we&apos;ll email you a link to sign in.
        </p>
      </div>
      <Card>
        <SignInForm callbackUrl={resolvedCallbackUrl} />
      </Card>
    </Container>
  );
}
