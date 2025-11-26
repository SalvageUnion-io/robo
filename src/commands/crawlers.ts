import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import type { CommandConfig, CommandOptions, CommandResult } from "robo.js";
import { getUserByDiscordId, getUserCrawlers } from "../lib/supabase-helpers";
import { embedFooterDetails } from "../core/constants";

export const config: CommandConfig = {
  description: "View your crawler IDs from salvageunion.io",
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

    const crawlers = await getUserCrawlers(user.id);

    if (crawlers.length === 0) {
      await interaction.editReply({
        content: "📭 You don't have any crawlers yet.",
      });
      return;
    }

    const crawlerIds = crawlers.map((c) => `\`${c.id}\``).join(", ");

    const embed = new EmbedBuilder()
      .setTitle("🚗 Your Crawlers")
      .setDescription(
        crawlerIds.length > 4096
          ? crawlerIds.substring(0, 4093) + "..."
          : crawlerIds
      )
      .setColor(Colors.Orange)
      .setFooter(embedFooterDetails)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed.toJSON()] });
  } catch (error: any) {
    console.error("Error fetching crawlers:", error);
    await interaction.editReply({
      content:
        `❌ Error: ${error.message || "An error occurred while fetching your crawlers."}`,
    });
  }
};

