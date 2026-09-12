"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { emailSchema } from "@/lib/validation";

export interface SignInActionState {
  error?: string;
}

export async function requestSignInLink(
  _prevState: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  const callbackUrl = formData.get("callbackUrl");
  const redirectTo =
    typeof callbackUrl === "string" && callbackUrl.startsWith("/")
      ? callbackUrl
      : "/";

  try {
    // redirect: false avoids an extra round trip through Auth.js's own
    // /api/auth/verify-request page — we send the user straight to ours.
    await signIn("nodemailer", { email: parsed.data, redirectTo, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "We couldn't send that sign-in link. Please try again.",
      };
    }
    throw error;
  }

  redirect("/sign-in/check-email");
}
