-- pilotCFO — Shopify sync v2 (paginated + realtime-ready)

-- Extend shopify_connections with sync metadata
ALTER TABLE public.shopify_connections
  ADD COLUMN IF NOT EXISTS connected BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Normalized Shopify resources (raw-ish, source of truth for analytics)
CREATE TABLE IF NOT EXISTS public.shopify_orders (
  id BIGINT PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT,
  total_price NUMERIC,
  subtotal_price NUMERIC,
  total_discounts NUMERIC,
  total_tax NUMERIC,
  financial_status TEXT,
  fulfillment_status TEXT,
  cancelled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  customer_id BIGINT,
  line_items JSONB DEFAULT '[]',
  refunds JSONB DEFAULT '[]',
  shipping_lines JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_user_created
  ON public.shopify_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_shop_created
  ON public.shopify_orders(shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shopify_products (
  id BIGINT PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  vendor TEXT,
  product_type TEXT,
  variants JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shopify_products_user
  ON public.shopify_products(user_id);
CREATE INDEX IF NOT EXISTS idx_shopify_products_shop
  ON public.shopify_products(shop_id);

CREATE TABLE IF NOT EXISTS public.shopify_customers (
  id BIGINT PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  total_spent NUMERIC,
  orders_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shopify_customers_user
  ON public.shopify_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_shopify_customers_shop
  ON public.shopify_customers(shop_id);

-- RLS
ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own orders" ON public.shopify_orders;
DROP POLICY IF EXISTS "Users see own products" ON public.shopify_products;
DROP POLICY IF EXISTS "Users see own customers" ON public.shopify_customers;

CREATE POLICY "Users see own orders"
  ON public.shopify_orders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own products"
  ON public.shopify_products
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own customers"
  ON public.shopify_customers
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

