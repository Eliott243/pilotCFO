import crypto from "crypto";

const SCOPES = process.env.SHOPIFY_SCOPES ?? "read_orders,read_products,read_customers,read_inventory";

export function getShopifyAuthUrl(shop: string, state: string): string {
  const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
  const redirectUri = `${process.env.SHOPIFY_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL}/api/shopify/callback`;

  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_API_KEY!,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shopDomain}/admin/oauth/authorize?${params}`;
}

export function verifyShopifyHmac(
  query: Record<string, string>,
  secret: string
): boolean {
  const { hmac, ...rest } = query;
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("&");

  const generated = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(generated),
    Buffer.from(hmac)
  );
}

export async function exchangeShopifyToken(
  shop: string,
  code: string
): Promise<{ access_token: string; scope: string }> {
  const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;

  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`Shopify token exchange failed: ${response.statusText}`);
  }

  return response.json();
}

export async function shopifyAdminFetch<T>(
  shop: string,
  accessToken: string,
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
  const url = new URL(`https://${shopDomain}/admin/api/2024-10/${endpoint}.json`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
