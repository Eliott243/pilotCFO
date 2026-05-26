"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CheckCircle, RefreshCw } from "lucide-react";

interface ShopifyConnectProps {
  store: {
    shopify_domain: string;
    shop_name: string | null;
    last_synced_at: string | null;
  } | null;
  connected?: boolean;
  error?: string;
}

export function ShopifyConnect({ store, connected, error }: ShopifyConnectProps) {
  const [shop, setShop] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/shopify/sync", { method: "POST" });
      window.location.reload();
    } finally {
      setSyncing(false);
    }
  }

  if (store) {
    return (
      <div className="p-5 rounded-xl border border-border bg-card">
        {connected && (
          <p className="text-sm text-success mb-3 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            Boutique connectée avec succès
          </p>
        )}
        <p className="font-medium text-sm">{store.shop_name ?? store.shopify_domain}</p>
        <p className="text-xs text-muted mt-0.5">{store.shopify_domain}</p>
        {store.last_synced_at && (
          <p className="text-xs text-muted mt-2">
            Dernière sync · {new Date(store.last_synced_at).toLocaleString("fr-FR")}
          </p>
        )}
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchronisation..." : "Synchroniser les données"}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-border bg-card">
      {error && (
        <p className="text-sm text-danger mb-3">Erreur de connexion. Réessayez.</p>
      )}
      <Label htmlFor="shop">Nom de votre boutique Shopify</Label>
      <form action="/api/shopify/auth" method="GET" className="mt-2 flex gap-2">
        <div className="flex-1 flex items-center gap-0">
          <Input
            id="shop"
            name="shop"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="ma-boutique"
            required
            className="rounded-r-none"
          />
          <span className="px-3 py-2 text-sm bg-stone-50 border border-l-0 border-border rounded-r-lg text-muted">
            .myshopify.com
          </span>
        </div>
        <Button type="submit" disabled={!shop.trim()}>
          Connecter
        </Button>
      </form>
    </div>
  );
}
