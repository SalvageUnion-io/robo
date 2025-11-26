import type { APIEmbed, ChatInputCommandInteraction } from "discord.js";
import { Colors, EmbedBuilder } from "discord.js";
import type { CommandConfig, CommandResult } from "robo.js";
import { embedFooterDetails } from "../core/constants";
import { getSupabaseForUser } from "../core/supabase";

export const config: CommandConfig = {
  description: "View your pilots from Salvage Union",
};

interface Pilot {
  id: string;
  callsign: string;
  user_id?: string;
}

export function buildEmbed(pilots: Pilot[]): APIEmbed {
  const embed = new EmbedBuilder()
    .setTitle("Your Pilots")
    .setColor(Colors.Blue)
    .setFooter(embedFooterDetails);

  if (pilots.length === 0) {
    embed.setDescription("You don't have any pilots yet.");
    return embed.toJSON();
  }

  const pilotList = pilots
    .map(
      (pilot) =>
        `[${pilot.callsign}](https://salvageunion.io/dashboard/pilots/${pilot.id})`
    )
    .join("\n");

  embed.setDescription(pilotList);

  return embed.toJSON();
}

export default async (
  interaction: ChatInputCommandInteraction
): Promise<CommandResult> => {
  await interaction.deferReply();

  try {
    const discordUserId = interaction.user.id;

    // Get Supabase client for this user
    const userSupabase = getSupabaseForUser(discordUserId);

    if (!userSupabase) {
      const loginEmbed = new EmbedBuilder()
        .setTitle("Not Logged In")
        .setDescription(
          "You need to link your Discord account first. Use `/login` to get started."
        )
        .setColor(Colors.Yellow)
        .setFooter(embedFooterDetails);

      await interaction.editReply({ embeds: [loginEmbed.toJSON()] });
      return;
    }

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Failed to get user");
    }

    // Query pilots using the authenticated user's ID
    const { data: pilots, error } = await userSupabase
      .from("pilots")
      .select("id, callsign, user_id")
      .eq("user_id", user.id);

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned", which is fine
      throw error;
    }

    await interaction.editReply({
      embeds: [buildEmbed(pilots || [])],
    });
  } catch (error) {
    console.error("Error fetching pilots:", error);
    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription("Failed to fetch your pilots. Please try again later.")
      .setColor(Colors.Red)
      .setFooter(embedFooterDetails);

    await interaction.editReply({ embeds: [errorEmbed.toJSON()] });
  }
};
