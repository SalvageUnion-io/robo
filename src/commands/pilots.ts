import type { APIEmbed, ChatInputCommandInteraction } from "discord.js";
import { Colors, EmbedBuilder } from "discord.js";
import type { CommandConfig, CommandResult } from "robo.js";
import { embedFooterDetails } from "../core/constants";
import { supabase } from "../core/supabase";

export const config: CommandConfig = {
  description: "View your pilots from Salvage Union",
};

interface Pilot {
  id: string;
  name: string;
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
        `[${pilot.name}](https://salvageunion.io/dashboard/pilots/${pilot.id})`
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

    const { data: pilots, error } = await supabase
      .from("pilots")
      .select("id, name, user_id")
      .eq("user_id", discordUserId);

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
      .setDescription(
        "Failed to fetch your pilots. Please try again later."
      )
      .setColor(Colors.Red)
      .setFooter(embedFooterDetails);

    await interaction.editReply({ embeds: [errorEmbed.toJSON()] });
  }
};

