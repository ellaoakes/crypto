import { existsSync } from "node:fs";

/**
 * Integration tests talk to the real database, so they need the same .env the
 * app uses. Loaded here, before any test module imports the env loader.
 * Guarded so unit tests (which mock Prisma) still run without a .env present.
 */
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
