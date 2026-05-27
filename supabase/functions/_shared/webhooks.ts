import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

export async function verifyShopifyWebhook(
  body: string,
  hmacHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!hmacHeader) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));

  // timing-safe compare
  if (computed.length !== hmacHeader.length) return false;
  let out = 0;
  for (let i = 0; i < computed.length; i++) out |= computed.charCodeAt(i) ^ hmacHeader.charCodeAt(i);
  return out === 0;
}

