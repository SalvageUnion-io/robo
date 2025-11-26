import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import type { CommandConfig, CommandOptions, CommandResult } from "robo.js";
import { getUserByDiscordId, getUserMechs } from "../lib/supabase-helpers";
import { embedFooterDetails } from "../core/constants";

export const config: CommandConfig = {
  description: "View your mech IDs from salvageunion.io",
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

    const mechs = await getUserMechs(user.id);

    if (mechs.length === 0) {
      await interaction.editReply({
        content: "📭 You don't have any mechs yet.",
      });
      return;
    }

    const mechIds = mechs.map((m) => `\`${m.id}\``).join(", ");

    const embed = new EmbedBuilder()
      .setTitle("🤖 Your Mechs")
      .setDescription(
        mechIds.length > 4096 ? mechIds.substring(0, 4093) + "..." : mechIds
      )
      .setColor(Colors.Purple)
      .setFooter(embedFooterDetails)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed.toJSON()] });
  } catch (error: any) {
    console.error("Error fetching mechs:", error);
    await interaction.editReply({
      content:
        `❌ Error: ${error.message || "An error occurred while fetching your mechs."}`,
    });
  }
};

