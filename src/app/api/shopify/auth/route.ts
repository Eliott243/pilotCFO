import { NextRequest, NextResponse } from "next/server";
import { getShopifyAuthUrl } from "@/lib/shopify/client";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");

  if (!shop || !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(shop.replace(".myshopify.com", ""))) {
    return NextResponse.json({ error: "Boutique invalide" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = crypto.randomBytes(16).toString("hex");

  const response = NextResponse.redirect(getShopifyAuthUrl(shop, state));
  response.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
  });
  response.cookies.set("shopify_oauth_user", user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
  });

  return response;
}
