import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

const supabase: SupabaseClient = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;
