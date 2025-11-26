import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is required");
}

// Prefer service role key for server-side operations (can access auth.identities)
// Fall back to anon key if service role is not available
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  throw new Error(
    "Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required"
  );
}

export const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);
