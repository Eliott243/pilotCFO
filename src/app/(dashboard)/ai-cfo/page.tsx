import { Suspense } from "react";
import { AICFOChat } from "@/components/ai-cfo/chat";
import { PageHeader } from "@/components/dashboard/page-header";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/billing/entitlements";

export default async function AICFOPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const entitlements = user
    ? await getEntitlements(supabase, user.id)
    : { premium: false };

  return (
    <>
      <PageHeader
        title="AI CFO"
        subtitle="Posez vos questions comme à un directeur financier. Réponses basées sur vos données Shopify et le moteur CFO."
      />
      {entitlements.premium ? (
        <Suspense fallback={<div className="text-sm text-muted py-8">Chargement...</div>}>
          <AICFOChat />
        </Suspense>
      ) : (
        <UpgradePrompt
          feature="AI CFO"
          description="Discutez avec votre directeur financier IA. Disponible avec le plan Growth — votre essai inclut 14 jours d'accès complet."
        />
      )}
    </>
  );
}
