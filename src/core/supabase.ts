import { createClient } from "@supabase/supabase-js";
import { getSession } from "./sessionStore.js";

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is not set");
}

if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY environment variable is not set");
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Create a Supabase client with a user's session
export function createUserClient(accessToken: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

// Get Supabase client for a Discord user
export function getSupabaseForUser(discordUserId: string) {
  const session = getSession(discordUserId);
  if (!session) {
    return null;
  }
  return createUserClient(session.accessToken);
}

