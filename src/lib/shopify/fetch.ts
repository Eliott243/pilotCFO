import { shopifyAdminFetch } from "./client";

export default async function fetchShopifyResource<T>(
  shop: string,
  accessToken: string,
  resource: string,
  params?: Record<string, string>
): Promise<T[]> {
  const data = await shopifyAdminFetch<Record<string, T[]>>(
    shop,
    accessToken,
    resource,
    params
  );

  const key = Object.keys(data).find((k) => Array.isArray(data[k]));
  return key ? data[key] : [];
}
