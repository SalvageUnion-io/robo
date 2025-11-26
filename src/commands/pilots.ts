import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import type { CommandConfig, CommandOptions, CommandResult } from "robo.js";
import { getUserByDiscordId, getUserPilots } from "../lib/supabase-helpers";
import { embedFooterDetails } from "../core/constants";

export const config: CommandConfig = {
  description: "View your pilots from salvageunion.io",
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

    const pilots = await getUserPilots(user.id);

    if (pilots.length === 0) {
      await interaction.editReply({
        content: "📭 You don't have any pilots yet.",
      });
      return;
    }

    // Create individual embeds for each pilot (Discord limit: 10 embeds per message)
    const embeds = pilots.slice(0, 10).map((pilot) => {
      const title = pilot.callsign || "Unnamed Pilot";
      const url = `https://salvageunion.io/dashboard/pilots/${pilot.id}`;
      
      return new EmbedBuilder()
        .setTitle(title)
        .setURL(url)
        .setColor(Colors.Green)
        .setFooter(embedFooterDetails)
        .setTimestamp();
    });

    // If there are more than 10 pilots, add a note
    if (pilots.length > 10) {
      const lastEmbed = embeds[embeds.length - 1];
      lastEmbed.setDescription(
        `*Showing 10 of ${pilots.length} pilots. Visit your dashboard to see all.*`
      );
    }

    await interaction.editReply({ embeds: embeds.map((e) => e.toJSON()) });
  } catch (error: any) {
    console.error("Error fetching pilots:", error);
    await interaction.editReply({
      content:
        `❌ Error: ${error.message || "An error occurred while fetching your pilots."}`,
    });
  }
};

