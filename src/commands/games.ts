import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import type { CommandConfig, CommandOptions, CommandResult } from "robo.js";
import { getUserByDiscordId, getUserGames } from "../lib/supabase-helpers";
import { embedFooterDetails } from "../core/constants";

export const config: CommandConfig = {
  description: "View your game IDs from salvageunion.io",
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

    const games = await getUserGames(user.id);

    if (games.length === 0) {
      await interaction.editReply({
        content: "📭 You don't have any games yet.",
      });
      return;
    }

    const gameIds = games.map((g) => `\`${g.id}\``).join(", ");

    const embed = new EmbedBuilder()
      .setTitle("🎮 Your Games")
      .setDescription(
        gameIds.length > 4096 ? gameIds.substring(0, 4093) + "..." : gameIds
      )
      .setColor(Colors.Blue)
      .setFooter(embedFooterDetails)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed.toJSON()] });
  } catch (error: any) {
    console.error("Error fetching games:", error);
    await interaction.editReply({
      content:
        `❌ Error: ${error.message || "An error occurred while fetching your games."}`,
    });
  }
};

