import "server-only";
import crypto from "crypto";
import { logSecurity } from "@/lib/logging";

/**
 * AES-256-GCM encryption for secrets at rest (Shopify access tokens).
 *
 * Wire format (versioned for future key rotation):
 *   enc:v1:<base64( iv(12) || ciphertext || authTag(16) )>
 *
 * Layout matches the WebCrypto AES-GCM convention (ciphertext||tag) so the
 * Supabase Edge Functions (Deno, supabase/functions/_shared/crypto.ts) can
 * decrypt the exact same payload.
 *
 * Rollout safety:
 *  - encryptToken returns plaintext unchanged when SHOPIFY_TOKEN_ENC_KEY is
 *    unset, so deploying this code does NOT require the key to exist yet.
 *  - decryptToken passes through any value without the enc:v1: prefix, so
 *    already-stored plaintext tokens keep working during migration.
 * Enable encryption by setting SHOPIFY_TOKEN_ENC_KEY in BOTH the Next.js app
 * and the Supabase Edge Function secrets, then reconnecting stores.
 */

const PREFIX = "enc:v1:";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer | null {
  const raw = process.env.SHOPIFY_TOKEN_ENC_KEY;
  if (!raw) return null;
  // Derive a fixed 32-byte key from whatever secret is provided (passphrase,
  // base64, hex — all accepted). Deterministic and identical in Deno.
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // encryption disabled — store as-is (rollout safe)

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, ciphertext, tag]);
  return PREFIX + payload.toString("base64");
}

export function decryptToken(value: string): string {
  if (!isEncrypted(value)) return value; // legacy plaintext

  const key = getKey();
  if (!key) {
    logSecurity("token_decrypt_no_key", {}, "error");
    throw new Error("SHOPIFY_TOKEN_ENC_KEY is required to decrypt this token");
  }

  const payload = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = payload.subarray(0, IV_LEN);
  const tag = payload.subarray(payload.length - TAG_LEN);
  const ciphertext = payload.subarray(IV_LEN, payload.length - TAG_LEN);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
