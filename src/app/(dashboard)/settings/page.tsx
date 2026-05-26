import { PageHeader } from "@/components/dashboard/page-header";
import { ShopifyConnect } from "@/components/settings/shopify-connect";
import { SubscriptionPanel } from "@/components/settings/subscription-panel";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; shopify?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: company }, { data: store }, { data: subscription }] = await Promise.all([
    supabase.from("companies").select("*").eq("user_id", user!.id).single(),
    supabase
      .from("stores")
      .select("shopify_domain, shop_name, last_synced_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("subscriptions").select("*").eq("user_id", user!.id).single(),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Gérez votre boutique Shopify, abonnement et préférences."
      />

      <div className="space-y-8 max-w-2xl">
        <section>
          <h2 className="text-sm font-medium mb-4">Boutique Shopify</h2>
          <ShopifyConnect
            store={store}
            connected={params.shopify === "connected"}
            error={params.error}
          />
        </section>

        <section>
          <h2 className="text-sm font-medium mb-4">Entreprise</h2>
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
            <a href="/questionnaire" className="text-xs text-accent hover:underline">
              Modifier le questionnaire CFO →
            </a>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium mb-4">Abonnement</h2>
          <SubscriptionPanel subscription={subscription} />
        </section>
      </div>
    </>
  );
}
