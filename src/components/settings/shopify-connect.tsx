"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, RefreshCw } from "lucide-react";

interface ShopifyConnectProps {
  store: {
    id: string;
    shopify_domain: string;
    shop_name: string | null;
  } | null;
  connection: {
    id: string;
    last_synced_at: string | null;
    sync_status: string | null;
    sync_error: string | null;
    connected: boolean | null;
  } | null;
  connected?: boolean;
  error?: string;
}

function minutesAgo(iso: string): number {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

export function ShopifyConnect({ store, connection, connected, error }: ShopifyConnectProps) {
  const [shop, setShop] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [webhooksStatus, setWebhooksStatus] = useState<
    "idle" | "registering" | "registered" | "error"
  >("idle");

  const status = useMemo(() => {
    const last = connection?.last_synced_at;
    const syncStatus = connection?.sync_status ?? "never";
    if (!last) return { dot: "⚪", text: "Never synced" as const, sub: "Aucune synchronisation" };
    if (syncStatus === "syncing") return { dot: "🟡", text: "Syncing..." as const, sub: "Synchronisation en cours" };
    if (syncStatus === "error") return { dot: "🔴", text: "Sync failed" as const, sub: "Échec de synchronisation" };
    if (minutesAgo(last) < 60) return { dot: "🟢", text: "Data up to date" as const, sub: `Dernière sync il y a ${minutesAgo(last)} min` };
    return { dot: "🟡", text: "Data may be stale" as const, sub: `Dernière sync il y a ${minutesAgo(last)} min` };
  }, [connection]);

  useEffect(() => {
    async function registerWebhooks() {
      if (!connected || !connection?.id) return;
      setWebhooksStatus("registering");
      try {
        const supabase = createClient();
        const functionsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
        const { error: invokeError } = await supabase.functions.invoke(
          "register-shopify-webhooks",
          {
            body: { shop_id: connection.id, supabase_functions_url: functionsUrl },
          }
        );
        if (invokeError) throw new Error(invokeError.message);
        setWebhooksStatus("registered");
      } catch {
        setWebhooksStatus("error");
      }
    }

    registerWebhooks();
  }, [connected, connection?.id]);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const supabase = createClient();
      // Find connection id (shopify_connections.id)
      const { data: conn } = await supabase
        .from("shopify_connections")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!conn?.id) throw new Error("No Shopify connection found.");

      const { error: invokeError } = await supabase.functions.invoke("sync-shopify-data", {
        body: { shop_id: conn.id },
      });

      if (invokeError) throw new Error(invokeError.message);
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setSyncError(msg);
    } finally {
      setSyncing(false);
    }
  }

  if (store && connection) {
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
        <div className="mt-3 text-xs text-muted space-y-1">
          <p>
            <span className="mr-1">{status.dot}</span>
            <span className="text-foreground/80">{status.text}</span>
            <span className="ml-2">{status.sub}</span>
          </p>
          {connected && (
            <p>
              {webhooksStatus === "registering"
                ? "🟡 Webhooks: enregistrement…"
                : webhooksStatus === "registered"
                ? "🟢 Webhooks: actifs"
                : webhooksStatus === "error"
                ? "🔴 Webhooks: échec"
                : "⚪ Webhooks: —"}
            </p>
          )}
          {connection?.sync_error && status.text === "Sync failed" && (
            <p className="text-danger">Erreur: {connection.sync_error}</p>
          )}
          {syncError && <p className="text-danger">Erreur: {syncError}</p>}
        </div>
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
      <form action="/api/shopify/auth" method="GET" className="mt-2 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-stretch min-w-0">
          <Input
            id="shop"
            name="shop"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="ma-boutique"
            required
            className="rounded-r-none min-w-0"
          />
          <span className="px-2 sm:px-3 py-2 text-xs sm:text-sm bg-stone-50 border border-l-0 border-border rounded-r-lg text-muted whitespace-nowrap shrink-0 flex items-center">
            .myshopify.com
          </span>
        </div>
        <Button type="submit" disabled={!shop.trim()} className="w-full sm:w-auto shrink-0">
          Connecter
        </Button>
      </form>
    </div>
  );
}
