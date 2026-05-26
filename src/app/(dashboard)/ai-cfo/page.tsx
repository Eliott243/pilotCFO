import { Suspense } from "react";
import { AICFOChat } from "@/components/ai-cfo/chat";
import { PageHeader } from "@/components/dashboard/page-header";

export default function AICFOPage() {
  return (
    <>
      <PageHeader
        title="AI CFO"
        subtitle="Posez vos questions comme à un directeur financier. Réponses basées sur vos données Shopify et le moteur CFO."
      />
      <Suspense fallback={<div className="text-sm text-muted py-8">Chargement...</div>}>
        <AICFOChat />
      </Suspense>
    </>
  );
}
