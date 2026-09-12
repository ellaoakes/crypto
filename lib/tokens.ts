import { randomBytes } from "crypto";

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i — easier to read aloud and type

/** Short, shareable trip code, e.g. "kx7p4qde" — goes in the public join link. */
export function generateSlug(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

/** Long, unguessable secret for admin/participant links — not meant to be typed. */
export function generateSecretToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Reference shown to a participant for their deposit payment. */
export function generatePaymentReference(): string {
  return `KTY-${randomBytes(6).toString("hex").toUpperCase()}`;
}
