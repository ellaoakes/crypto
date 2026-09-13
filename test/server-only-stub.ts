/**
 * `server-only` throws when imported outside a React Server Component, which
 * includes Vitest. Aliased in vitest.config.ts so server modules can be unit
 * tested. The real guarantee is unaffected: the Next.js build still refuses
 * to pull these modules into a client bundle.
 */
export {};
