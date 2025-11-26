import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import type { CommandConfig, CommandOptions, CommandResult } from "robo.js";
import { getUserByDiscordId, getUserGames } from "../lib/supabase-helpers";
import { embedFooterDetails } from "../core/constants";

export const config: CommandConfig = {
  description: "View your games from salvageunion.io",
};

export default async (
  interaction: ChatInputCommandInteraction,
  _options: CommandOptions<typeof config>
): Promise<CommandResult> => {
  // Defer immediately to prevent interaction timeout
  try {
    await interaction.deferReply();
  } catch (error: any) {
    // If interaction already expired or was replied to, log and return
    if (error.code === 10062 || error.code === 40060) {
      console.error("Interaction expired before defer:", error);
      return;
    }
    throw error;
  }

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

    // Create individual embeds for each game (Discord limit: 10 embeds per message)
    const embeds = games.slice(0, 10).map((game) => {
      const title = game.name || "Unnamed Game";
      const url = `https://salvageunion.io/dashboard/games/${game.id}`;
      
      return new EmbedBuilder()
        .setTitle(title)
        .setURL(url)
        .setColor(Colors.Blue)
        .setFooter(embedFooterDetails)
        .setTimestamp();
    });

    // If there are more than 10 games, add a note
    if (games.length > 10) {
      const lastEmbed = embeds[embeds.length - 1];
      lastEmbed.setDescription(
        `*Showing 10 of ${games.length} games. Visit your dashboard to see all.*`
      );
    }

    await interaction.editReply({ embeds: embeds.map((e) => e.toJSON()) });
  } catch (error: any) {
    console.error("Error fetching games:", error);
    await interaction.editReply({
      content:
        `❌ Error: ${error.message || "An error occurred while fetching your games."}`,
    });
  }
};

