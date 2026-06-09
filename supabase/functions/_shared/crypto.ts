// AES-256-GCM token decryption for Supabase Edge Functions (Deno / WebCrypto).
//
// Mirrors src/lib/crypto/token.ts in the Next.js app. Wire format:
//   enc:v1:<base64( iv(12) || ciphertext || authTag(16) )>
//
// Backward compatible: values without the enc:v1: prefix are returned as-is
// (legacy plaintext tokens), so this can be deployed before any token is
// encrypted. Set SHOPIFY_TOKEN_ENC_KEY in the Edge Function secrets to enable.

const PREFIX = "enc:v1:";
const IV_LEN = 12;

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

async function getKey(): Promise<CryptoKey | null> {
  const raw = Deno.env.get("SHOPIFY_TOKEN_ENC_KEY");
  if (!raw) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function decryptToken(value: string): Promise<string> {
  if (!isEncrypted(value)) return value; // legacy plaintext

  const key = await getKey();
  if (!key) {
    throw new Error("SHOPIFY_TOKEN_ENC_KEY is required to decrypt this token");
  }

  const payload = base64ToBytes(value.slice(PREFIX.length));
  const iv = payload.subarray(0, IV_LEN);
  // WebCrypto expects ciphertext||tag as the data argument.
  const data = payload.subarray(IV_LEN);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return new TextDecoder().decode(plaintext);
}
