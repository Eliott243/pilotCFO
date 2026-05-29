import { NextRequest, NextResponse } from "next/server";
import {
  exchangeShopifyToken,
  shopifyAdminFetch,
  verifyShopifyHmac,
} from "@/lib/shopify/client";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

  const authSupabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await authSupabase.auth.getUser();

  if (!sessionUser || sessionUser.id !== userId) {
    return NextResponse.redirect(
      new URL("/settings?error=oauth", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const queryForHmac = { ...params };
  if (!verifyShopifyHmac(queryForHmac, process.env.SHOPIFY_API_SECRET!)) {
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

    const shopCurrency = shopInfo.currency ?? "USD";
    const shopCountry = shopInfo.country_name ?? shopInfo.country_code ?? null;

    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id, name, country")
      .eq("user_id", userId)
      .maybeSingle();

    let companyId: string;

    if (!existingCompany) {
      const { data: createdCompany, error: createError } = await supabase
        .from("companies")
        .insert({
          user_id: userId,
          name: shopInfo.name ?? shopDomain,
          country: shopCountry,
          currency: shopCurrency,
        })
        .select("id")
        .single();

      if (createError || !createdCompany) throw createError;
      companyId = createdCompany.id;
    } else {
      companyId = existingCompany.id;
      const companyUpdates: Record<string, unknown> = { currency: shopCurrency };
      if (!existingCompany.name) companyUpdates.name = shopInfo.name ?? shopDomain;
      if (!existingCompany.country && shopCountry) companyUpdates.country = shopCountry;

      await supabase.from("companies").update(companyUpdates).eq("id", existingCompany.id);
    }

    const { data: existingStore } = await supabase
      .from("stores")
      .select("id, company_id, companies!inner(user_id)")
      .eq("shopify_domain", shopDomain)
      .maybeSingle();

    const existingOwnerId = existingStore
      ? (
          existingStore.companies as { user_id: string } | { user_id: string }[]
        ) &&
        (Array.isArray(existingStore.companies)
          ? existingStore.companies[0]?.user_id
          : (existingStore.companies as { user_id: string }).user_id)
      : null;

    if (existingOwnerId && existingOwnerId !== userId) {
      return NextResponse.redirect(
        new URL("/settings?error=shop_taken", process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    let storeId: string;

    if (existingStore) {
      const { data: updatedStore, error: updateError } = await supabase
        .from("stores")
        .update({
          shop_name: shopInfo.name,
          shop_email: shopInfo.email,
          currency: shopInfo.currency ?? "USD",
          timezone: shopInfo.timezone,
          is_active: true,
        })
        .eq("id", existingStore.id)
        .select("id")
        .single();

      if (updateError || !updatedStore) throw updateError;
      storeId = updatedStore.id;
    } else {
      const { data: newStore, error: insertError } = await supabase
        .from("stores")
        .insert({
          company_id: companyId,
          shopify_domain: shopDomain,
          shop_name: shopInfo.name,
          shop_email: shopInfo.email,
          currency: shopInfo.currency ?? "USD",
          timezone: shopInfo.timezone,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError || !newStore) throw insertError;
      storeId = newStore.id;
    }

    await supabase.from("shopify_connections").upsert(
      {
        store_id: storeId,
        access_token,
        scope,
        connected: true,
        sync_status: "never",
        sync_error: null,
      },
      { onConflict: "store_id" }
    );

    await syncShopifyStore(supabase, storeId, shopDomain, access_token);

    await supabase.from("activity_logs").insert({
      user_id: userId,
      action: "shopify_connected",
      resource_type: "store",
      resource_id: storeId,
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
