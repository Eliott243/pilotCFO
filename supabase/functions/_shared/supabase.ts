import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export function getServiceSupabase() {
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase service role env vars");
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

