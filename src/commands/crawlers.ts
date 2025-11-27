import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import type { CommandConfig, CommandOptions, CommandResult } from "robo.js";
import { getUserByDiscordId, getUserCrawlers } from "../lib/supabase-helpers";
import { embedFooterDetails } from "../core/constants";

export const config: CommandConfig = {
  description: "View your crawlers from salvageunion.io",
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
          "❌ No account found. Please visit salvageunion.io to sign up.",
      });
      return;
    }

    const crawlers = await getUserCrawlers(user.id);

    if (crawlers.length === 0) {
      await interaction.editReply({
        content: "📭 You don't have any crawlers yet.",
      });
      return;
    }

    // Create individual embeds for each crawler (Discord limit: 10 embeds per message)
    const embeds = crawlers.slice(0, 10).map((crawler) => {
      const title = crawler.name || "Unnamed Crawler";
      const url = `https://salvageunion.io/dashboard/crawlers/${crawler.id}`;
      
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setURL(url)
        .setColor(Colors.Orange)
        .setFooter(embedFooterDetails)
        .setTimestamp();

      // Add tech level field if available
      if (crawler.tech_level !== null && crawler.tech_level !== undefined) {
        embed.addFields({
          name: "TL",
          value: String(crawler.tech_level),
          inline: true,
        });
      }

      return embed;
    });

    // If there are more than 10 crawlers, add a note
    if (crawlers.length > 10) {
      const lastEmbed = embeds[embeds.length - 1];
      lastEmbed.setDescription(
        `*Showing 10 of ${crawlers.length} crawlers. Visit your dashboard to see all.*`
      );
    }

    await interaction.editReply({ embeds: embeds.map((e) => e.toJSON()) });
  } catch (error: any) {
    console.error("Error fetching crawlers:", error);
    await interaction.editReply({
      content:
        `❌ Error: ${error.message || "An error occurred while fetching your crawlers."}`,
    });
  }
};

