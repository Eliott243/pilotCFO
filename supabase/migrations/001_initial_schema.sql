-- pilotCFO — Initial Schema
-- Run via Supabase CLI or SQL Editor

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid');
CREATE TYPE subscription_plan AS ENUM ('trial', 'starter', 'growth', 'scale');
CREATE TYPE audit_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE report_type AS ENUM ('monthly', 'quarterly', 'annual', 'custom');
CREATE TYPE activity_action AS ENUM (
  'login', 'logout', 'shopify_connected', 'shopify_synced',
  'questionnaire_completed', 'onboarding_completed', 'report_generated',
  'subscription_created', 'subscription_canceled', 'settings_updated'
);

-- Users (extends auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  questionnaire_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT,
  currency TEXT DEFAULT 'USD',
  founded_year INTEGER,
  employee_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Stores (Shopify shops)
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shopify_domain TEXT NOT NULL,
  shop_name TEXT,
  shop_email TEXT,
  currency TEXT DEFAULT 'USD',
  timezone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shopify_domain)
);

-- Shopify OAuth connections
CREATE TABLE public.shopify_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  scope TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id)
);

-- Financial profiles (CFO questionnaire)
CREATE TABLE public.financial_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Revenue
  annual_revenue NUMERIC(15,2),
  monthly_revenue_avg NUMERIC(15,2),
  annual_revenue_target NUMERIC(15,2),
  -- Margins
  avg_product_cost_pct NUMERIC(5,2),
  gross_margin_estimate_pct NUMERIC(5,2),
  logistics_cost_pct NUMERIC(5,2),
  -- Marketing
  meta_spend_monthly NUMERIC(15,2) DEFAULT 0,
  google_spend_monthly NUMERIC(15,2) DEFAULT 0,
  influencer_spend_monthly NUMERIC(15,2) DEFAULT 0,
  target_roas NUMERIC(8,2),
  -- Cash
  cash_available NUMERIC(15,2) DEFAULT 0,
  existing_debt NUMERIC(15,2) DEFAULT 0,
  credit_line NUMERIC(15,2) DEFAULT 0,
  estimated_runway_months NUMERIC(5,1),
  -- Growth
  growth_objectives_12m TEXT,
  planned_hires INTEGER DEFAULT 0,
  new_markets TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- Orders (synced from Shopify)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopify_order_id BIGINT NOT NULL,
  order_number TEXT,
  total_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  subtotal_price NUMERIC(15,2) DEFAULT 0,
  total_tax NUMERIC(15,2) DEFAULT 0,
  total_discounts NUMERIC(15,2) DEFAULT 0,
  total_shipping NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  financial_status TEXT,
  fulfillment_status TEXT,
  customer_id BIGINT,
  line_items_count INTEGER DEFAULT 0,
  refunded_amount NUMERIC(15,2) DEFAULT 0,
  cost_of_goods NUMERIC(15,2) DEFAULT 0,
  ordered_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, shopify_order_id)
);

CREATE INDEX idx_orders_store_ordered ON public.orders(store_id, ordered_at DESC);

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopify_product_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  vendor TEXT,
  product_type TEXT,
  status TEXT,
  price NUMERIC(15,2) DEFAULT 0,
  cost_per_item NUMERIC(15,2) DEFAULT 0,
  inventory_quantity INTEGER DEFAULT 0,
  total_sold INTEGER DEFAULT 0,
  total_revenue NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, shopify_product_id)
);

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopify_customer_id BIGINT NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  orders_count INTEGER DEFAULT 0,
  total_spent NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, shopify_customer_id)
);

-- Financial audits (diagnostics)
CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status audit_status DEFAULT 'pending',
  health_score INTEGER,
  profitability_score INTEGER,
  cash_score INTEGER,
  growth_score INTEGER,
  findings JSONB DEFAULT '[]',
  metrics_snapshot JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type report_type DEFAULT 'monthly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  title TEXT NOT NULL,
  executive_summary TEXT,
  revenue_section JSONB DEFAULT '{}',
  profitability_section JSONB DEFAULT '{}',
  cash_flow_section JSONB DEFAULT '{}',
  risks_section JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  forecasts_section JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI conversations
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  title TEXT DEFAULT 'Nouvelle conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs (audit trail)
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action activity_action NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id, created_at DESC);

-- Subscriptions (Stripe)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan subscription_plan DEFAULT 'trial',
  status subscription_status DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Settings
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  email_reports BOOLEAN DEFAULT TRUE,
  currency_display TEXT DEFAULT 'USD',
  fiscal_year_start INTEGER DEFAULT 1,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER financial_profiles_updated_at BEFORE UPDATE ON public.financial_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  INSERT INTO public.settings (user_id) VALUES (NEW.id);
  INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trialing', NOW() + INTERVAL '14 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Helper: get user's company id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT id FROM public.companies WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check store ownership
CREATE OR REPLACE FUNCTION user_owns_store(store_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    JOIN public.companies c ON c.id = s.company_id
    WHERE s.id = store_uuid AND c.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS Policies
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (id = auth.uid());

CREATE POLICY "companies_all_own" ON public.companies FOR ALL USING (user_id = auth.uid());

CREATE POLICY "stores_select_own" ON public.stores FOR SELECT
  USING (company_id = get_user_company_id());
CREATE POLICY "stores_insert_own" ON public.stores FOR INSERT
  WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "stores_update_own" ON public.stores FOR UPDATE
  USING (company_id = get_user_company_id());
CREATE POLICY "stores_delete_own" ON public.stores FOR DELETE
  USING (company_id = get_user_company_id());

CREATE POLICY "shopify_connections_own" ON public.shopify_connections FOR ALL
  USING (user_owns_store(store_id));

CREATE POLICY "financial_profiles_own" ON public.financial_profiles FOR ALL
  USING (company_id = get_user_company_id());

CREATE POLICY "orders_own" ON public.orders FOR ALL
  USING (user_owns_store(store_id));

CREATE POLICY "products_own" ON public.products FOR ALL
  USING (user_owns_store(store_id));

CREATE POLICY "customers_own" ON public.customers FOR ALL
  USING (user_owns_store(store_id));

CREATE POLICY "audits_own" ON public.audits FOR ALL
  USING (user_owns_store(store_id));

CREATE POLICY "reports_own" ON public.reports FOR ALL
  USING (user_owns_store(store_id));

CREATE POLICY "ai_conversations_own" ON public.ai_conversations FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "ai_messages_own" ON public.ai_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations ac
      WHERE ac.id = conversation_id AND ac.user_id = auth.uid()
    )
  );

CREATE POLICY "activity_logs_select_own" ON public.activity_logs FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "activity_logs_insert_own" ON public.activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "subscriptions_own" ON public.subscriptions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "settings_own" ON public.settings FOR ALL
  USING (user_id = auth.uid());
