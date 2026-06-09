-- pilotCFO — P0 production hardening (least privilege on user-writable data)
--
-- Goal: an authenticated client (browser, anon key) must NOT be able to grant
-- itself entitlements or flip lifecycle flags. Sensitive columns are writable
-- only by the service role (server-side routes). Run AFTER 004.

-- 1) users: restrict which columns an authenticated user may UPDATE.
--    Column-level privileges + explicit WITH CHECK. onboarding_completed,
--    questionnaire_completed, email, id, timestamps are NOT in the grant list,
--    so only the service role can change them (server-side completion routes).
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.users TO authenticated;

-- 2) companies: add explicit WITH CHECK so a user cannot reassign ownership.
DROP POLICY IF EXISTS "companies_all_own" ON public.companies;
CREATE POLICY "companies_select_own" ON public.companies
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "companies_insert_own" ON public.companies
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "companies_update_own" ON public.companies
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "companies_delete_own" ON public.companies
  FOR DELETE USING (user_id = auth.uid());

-- 3) settings: add explicit WITH CHECK on the existing FOR ALL policy.
DROP POLICY IF EXISTS "settings_own" ON public.settings;
CREATE POLICY "settings_own" ON public.settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4) subscriptions: hardening 004 already made these SELECT-only for
--    authenticated (no self-upgrade). Defensively ensure no write privileges
--    remain at the column/table level for authenticated clients. All billing
--    writes go through the Stripe webhook / checkout using the service role.
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;

-- 5) shopify_connections: already locked down by migration 004
--    (REVOKE ALL FROM authenticated + SELECT grant excluding access_token), so
--    tokens are written/read only by the service role. Nothing to add here.
