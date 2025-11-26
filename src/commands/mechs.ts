import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import type { CommandConfig, CommandOptions, CommandResult } from "robo.js";
import { getUserByDiscordId, getUserMechs } from "../lib/supabase-helpers";
import { embedFooterDetails } from "../core/constants";

export const config: CommandConfig = {
  description: "View your mechs from salvageunion.io",
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

    const mechs = await getUserMechs(user.id);

    if (mechs.length === 0) {
      await interaction.editReply({
        content: "📭 You don't have any mechs yet.",
      });
      return;
    }

    // Create individual embeds for each mech (Discord limit: 10 embeds per message)
    const embeds = mechs.slice(0, 10).map((mech) => {
      const chassisName = mech.chassis_name || "Unknown Chassis";
      const patternName = mech.pattern_name || "Unknown Pattern";
      const title = `${chassisName} // ${patternName}`;
      const url = `https://salvageunion.io/dashboard/mechs/${mech.id}`;
      
      return new EmbedBuilder()
        .setTitle(title)
        .setURL(url)
        .setColor(Colors.Purple)
        .setFooter(embedFooterDetails)
        .setTimestamp();
    });

    // If there are more than 10 mechs, add a note
    if (mechs.length > 10) {
      const lastEmbed = embeds[embeds.length - 1];
      lastEmbed.setDescription(
        `*Showing 10 of ${mechs.length} mechs. Visit your dashboard to see all.*`
      );
    }

    await interaction.editReply({ embeds: embeds.map((e) => e.toJSON()) });
  } catch (error: any) {
    console.error("Error fetching mechs:", error);
    await interaction.editReply({
      content:
        `❌ Error: ${error.message || "An error occurred while fetching your mechs."}`,
    });
  }
};

