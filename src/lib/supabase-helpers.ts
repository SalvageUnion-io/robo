import { supabase } from "../core/supabase";

/**
 * Find Supabase user ID by Discord user ID
 * Uses RPC function to query auth.identities table (auth schema not directly accessible)
 * 
 * Note: You need to create this function in Supabase SQL Editor:
 * 
 * CREATE OR REPLACE FUNCTION get_user_by_discord_id(discord_id TEXT)
 * RETURNS UUID AS $$
 * DECLARE
 *   found_user_id UUID;
 * BEGIN
 *   SELECT i.user_id INTO found_user_id
 *   FROM auth.identities i
 *   WHERE i.provider = 'discord'
 *     AND i.provider_user_id = discord_id
 *   LIMIT 1;
 *   
 *   RETURN found_user_id;
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 */
export async function getUserByDiscordId(discordId: string) {
  try {
    // Use RPC function to access auth.identities
    const { data, error } = await supabase.rpc("get_user_by_discord_id", {
      discord_id: discordId,
    });

    if (error) {
      // If function doesn't exist, provide helpful error
      if (error.code === "42883" || error.message?.includes("function")) {
        console.error(
          "Error: get_user_by_discord_id function not found. Please create it in Supabase SQL Editor."
        );
        console.error("Full error:", JSON.stringify(error, null, 2));
        return null;
      }
      console.error("Error calling get_user_by_discord_id RPC:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return null;
    }

    if (data) {
      return { id: data };
    }

    return null;
  } catch (err: any) {
    console.error("Error in getUserByDiscordId:", err);
    console.error("Error stack:", err.stack);
    return null;
  }
}

/**
 * Get games for a user (both created by them and games they're a member of)
 */
export async function getUserGames(userId: string) {
  // Get games where user is the creator
  const { data: createdGames, error: createdError } = await supabase
    .from("games")
    .select("id, name")
    .eq("created_by", userId);

  if (createdError) {
    throw createdError;
  }

  // Get games where user is a member
  const { data: memberGames, error: memberError } = await supabase
    .from("game_members")
    .select("game_id, games(id, name)")
    .eq("user_id", userId);

  if (memberError) {
    throw memberError;
  }

  // Combine and deduplicate
  const gameMap = new Map<string, { id: string; name: string }>();

  (createdGames || []).forEach((g) => {
    if (g.id) {
      gameMap.set(g.id, { id: g.id, name: g.name || "Unnamed Game" });
    }
  });

  (memberGames || []).forEach((m) => {
    const game = (m as any).games;
    if (game && game.id) {
      gameMap.set(game.id, { id: game.id, name: game.name || "Unnamed Game" });
    }
  });

  return Array.from(gameMap.values());
}

/**
 * Get mechs for a user
 */
export async function getUserMechs(userId: string) {
  const { data, error } = await supabase
    .from("mechs")
    .select("id, chassis_name, pattern_name")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Get pilots for a user
 */
export async function getUserPilots(userId: string) {
  const { data, error } = await supabase
    .from("pilots")
    .select("id, callsign")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Get crawlers for a user
 */
export async function getUserCrawlers(userId: string) {
  const { data, error } = await supabase
    .from("crawlers")
    .select("id, name")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return data || [];
}

