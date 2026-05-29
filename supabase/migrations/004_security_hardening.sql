-- pilotCFO — Security hardening (production)

-- Stripe webhook idempotency (service role only)
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow uninstall webhook to revoke tokens
ALTER TABLE public.shopify_connections
  ALTER COLUMN access_token DROP NOT NULL;

-- Subscriptions: users can read their row, not self-upgrade plan/status
DROP POLICY IF EXISTS "subscriptions_own" ON public.subscriptions;

CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- Shopify connections: hide access_token from authenticated clients
DROP POLICY IF EXISTS "shopify_connections_own" ON public.shopify_connections;

CREATE POLICY "shopify_connections_select_own" ON public.shopify_connections
  FOR SELECT USING (user_owns_store(store_id));

REVOKE ALL ON public.shopify_connections FROM authenticated;
GRANT SELECT (
  id,
  store_id,
  scope,
  expires_at,
  connected,
  last_synced_at,
  sync_status,
  sync_error,
  created_at,
  updated_at
) ON public.shopify_connections TO authenticated;
