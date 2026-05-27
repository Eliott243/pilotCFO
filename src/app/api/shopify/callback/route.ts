import { NextRequest, NextResponse } from "next/server";
import {
  exchangeShopifyToken,
  shopifyAdminFetch,
  verifyShopifyHmac,
} from "@/lib/shopify/client";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const { shop, code, state } = params;

  const savedState = request.cookies.get("shopify_oauth_state")?.value;
  const userId = request.cookies.get("shopify_oauth_user")?.value;

  if (!shop || !code || !state || state !== savedState || !userId) {
    return NextResponse.redirect(
      new URL("/settings?error=oauth", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const queryForHmac = { ...params };
  if (
    !verifyShopifyHmac(queryForHmac, process.env.SHOPIFY_API_SECRET!)
  ) {
    return NextResponse.redirect(
      new URL("/settings?error=hmac", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  try {
    const { access_token, scope } = await exchangeShopifyToken(shop, code);
    const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;

    const shopData = await shopifyAdminFetch<{ shop: Record<string, string> }>(
      shopDomain,
      access_token,
      "shop"
    );
    const shopInfo = shopData.shop;

    const supabase = await createServiceClient();

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!company) {
      return NextResponse.redirect(
        new URL("/questionnaire", process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .upsert(
        {
          company_id: company.id,
          shopify_domain: shopDomain,
          shop_name: shopInfo.name,
          shop_email: shopInfo.email,
          currency: shopInfo.currency ?? "USD",
          timezone: shopInfo.timezone,
          is_active: true,
        },
        { onConflict: "shopify_domain" }
      )
      .select("id")
      .single();

    if (storeError || !store) throw storeError;

    await supabase.from("shopify_connections").upsert(
      {
        store_id: store.id,
        access_token,
        scope,
        connected: true,
        sync_status: "never",
        sync_error: null,
      },
      { onConflict: "store_id" }
    );

    // Initial sync still runs in-app; the UI can trigger full paginated Edge sync.
    await syncShopifyStore(supabase, store.id, shopDomain, access_token);

    await supabase.from("activity_logs").insert({
      user_id: userId,
      action: "shopify_connected",
      resource_type: "store",
      resource_id: store.id,
    });

    const response = NextResponse.redirect(
      new URL("/settings?shopify=connected", process.env.NEXT_PUBLIC_APP_URL!)
    );
    response.cookies.delete("shopify_oauth_state");
    response.cookies.delete("shopify_oauth_user");
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/settings?error=sync", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }
}
