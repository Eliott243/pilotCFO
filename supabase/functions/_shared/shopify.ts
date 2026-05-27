export function parseShopDomain(shop: string): string {
  const trimmed = shop.trim();
  if (!trimmed) throw new Error("Missing shop");
  return trimmed.includes(".myshopify.com") ? trimmed : `${trimmed}.myshopify.com`;
}

export function getNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return nextMatch ? nextMatch[1] : null;
}

export async function fetchAllPages(
  shop: string,
  accessToken: string,
  endpoint: string,
  query: Record<string, string> = {},
): Promise<any[]> {
  const results: any[] = [];
  const shopDomain = parseShopDomain(shop);
  const base = new URL(`https://${shopDomain}/admin/api/2024-01/${endpoint}.json`);
  base.searchParams.set("limit", "250");
  for (const [k, v] of Object.entries(query)) base.searchParams.set(k, v);

  let url: string | null = base.toString();
  while (url) {
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Shopify API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const key = endpoint.split("/")[0];
    results.push(...(data[key] || []));

    const linkHeader = res.headers.get("Link");
    url = getNextLink(linkHeader);
  }

  return results;
}

