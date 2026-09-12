import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function setBaseEnv() {
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
  process.env.AUTH_SECRET = "a".repeat(32);
  process.env.APP_URL = "http://localhost:3000";
}

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("loads successfully with the minimum required variables", async () => {
    setBaseEnv();
    const { env } = await import("@/lib/env");
    expect(env.DATABASE_URL).toBe(process.env.DATABASE_URL);
  });

  it("throws a descriptive error when AUTH_SECRET is missing", async () => {
    setBaseEnv();
    delete process.env.AUTH_SECRET;

    await expect(import("@/lib/env")).rejects.toThrow(/AUTH_SECRET/);
  });

  it("reports email delivery as unconfigured when SMTP vars are absent", async () => {
    setBaseEnv();
    const { isEmailDeliveryConfigured } = await import("@/lib/env");
    expect(isEmailDeliveryConfigured).toBe(false);
  });

  it("reports email delivery as configured when all SMTP vars are present", async () => {
    setBaseEnv();
    process.env.EMAIL_SERVER_HOST = "smtp.example.com";
    process.env.EMAIL_SERVER_USER = "user";
    process.env.EMAIL_SERVER_PASSWORD = "pass";
    process.env.EMAIL_FROM = "Group Trip <no-reply@example.com>";

    const { isEmailDeliveryConfigured } = await import("@/lib/env");
    expect(isEmailDeliveryConfigured).toBe(true);
  });
});
