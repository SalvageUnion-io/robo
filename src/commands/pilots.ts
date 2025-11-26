import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import type { CommandConfig, CommandOptions, CommandResult } from "robo.js";
import { getUserByDiscordId, getUserPilots } from "../lib/supabase-helpers";
import { embedFooterDetails } from "../core/constants";

export const config: CommandConfig = {
  description: "View your pilot IDs from salvageunion.io",
};

export default async (
  interaction: ChatInputCommandInteraction,
  _options: CommandOptions<typeof config>
): Promise<CommandResult> => {
  await interaction.deferReply();

  try {
    const discordUserId = interaction.user.id;

    const user = await getUserByDiscordId(discordUserId);

    if (!user) {
      await interaction.editReply({
        content:
          "❌ No account found. Please link your Discord account at salvageunion.io first.",
      });
      return;
    }

    const pilots = await getUserPilots(user.id);

    if (pilots.length === 0) {
      await interaction.editReply({
        content: "📭 You don't have any pilots yet.",
      });
      return;
    }

    const pilotIds = pilots.map((p) => `\`${p.id}\``).join(", ");

    const embed = new EmbedBuilder()
      .setTitle("👤 Your Pilots")
      .setDescription(
        pilotIds.length > 4096 ? pilotIds.substring(0, 4093) + "..." : pilotIds
      )
      .setColor(Colors.Green)
      .setFooter(embedFooterDetails)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed.toJSON()] });
  } catch (error: any) {
    console.error("Error fetching pilots:", error);
    await interaction.editReply({
      content:
        `❌ Error: ${error.message || "An error occurred while fetching your pilots."}`,
    });
  }
};

