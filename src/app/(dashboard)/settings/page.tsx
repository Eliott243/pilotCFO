import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ShopifyConnect } from "@/components/settings/shopify-connect";
import { SubscriptionPanel } from "@/components/settings/subscription-panel";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; shopify?: string; error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: company }, { data: store }, { data: subscription }, { data: connection }] =
    await Promise.all([
    supabase.from("companies").select("*").eq("user_id", user.id).single(),
    supabase
      .from("stores")
      .select("id, shopify_domain, shop_name")
      .limit(1)
      .maybeSingle(),
    supabase.from("subscriptions").select("*").eq("user_id", user.id).single(),
    supabase
      .from("shopify_connections")
      .select("id, last_synced_at, sync_status, sync_error, connected")
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <>
      <PageHeader
        title={dict.settings.title}
        subtitle={dict.settings.subtitle}
      />

      <div className="space-y-8 max-w-2xl">
        {params.shopify === "connected" && (
          <p className="text-sm text-success">Boutique Shopify connectée avec succès.</p>
        )}
        {params.error === "shop_taken" && (
          <p className="text-sm text-danger">
            Cette boutique est déjà connectée à un autre compte pilotCFO.
          </p>
        )}
        {params.error && params.error !== "shop_taken" && (
          <p className="text-sm text-danger">
            Erreur de connexion Shopify. Réessayez.
          </p>
        )}

        <section>
          <h2 className="text-sm font-medium mb-4">{dict.settings.language}</h2>
          <LocaleSwitcher current={locale} />
        </section>

        <section id="shopify">
          <h2 className="text-sm font-medium mb-4">{dict.settings.shopifyStore}</h2>
          <ShopifyConnect
            store={store}
            connection={connection}
            connected={params.shopify === "connected"}
            error={params.error}
          />
        </section>

        <section>
          <h2 className="text-sm font-medium mb-4">{dict.settings.company}</h2>
          <div className="p-5 rounded-xl border border-border bg-card space-y-2">
            <p className="text-sm">
              <span className="text-muted">Nom · </span>
              {company?.name ?? "—"}
            </p>
            <p className="text-sm">
              <span className="text-muted">Pays · </span>
              {company?.country ?? "—"}
            </p>
            <p className="text-sm">
              <span className="text-muted">Devise · </span>
              {company?.currency ?? "USD"}
            </p>
            <a href="/settings/company" className="text-xs text-accent hover:underline">
              Modifier les informations de l&apos;entreprise →
            </a>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium mb-4">{dict.settings.subscription}</h2>
          <SubscriptionPanel subscription={subscription} />
        </section>
      </div>
    </>
  );
}
