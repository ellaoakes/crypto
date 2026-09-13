import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)"),
  APP_URL: z.url().default("http://localhost:3000"),
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.coerce.number().int().positive().optional(),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Stripe. Secret keys are read here and must never be imported into a
  // client component — only STRIPE_PUBLISHABLE_KEY is safe to send to a
  // browser. Optional so the app runs without payments configured; the
  // payment surface reports itself unavailable rather than half-working.
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment variables:\n${issues}\n\nCopy .env.example to .env and fill in the missing values.`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();

/**
 * The Email provider needs a real SMTP transport to send anything. Without
 * one, sign-in links are logged to the server console instead — this keeps
 * local dev and CI working without real credentials.
 */
export const isEmailDeliveryConfigured = Boolean(
  env.EMAIL_SERVER_HOST &&
    env.EMAIL_SERVER_USER &&
    env.EMAIL_SERVER_PASSWORD &&
    env.EMAIL_FROM,
);

/**
 * Payments need all three Stripe values: the secret key to create intents,
 * the publishable key for the browser to confirm them, and the webhook
 * secret to verify that Stripe — and not someone else — told us a payment
 * succeeded. Missing any one of them means payments are off, not partly on.
 */
export const isStripeConfigured = Boolean(
  env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY && env.STRIPE_WEBHOOK_SECRET,
);
