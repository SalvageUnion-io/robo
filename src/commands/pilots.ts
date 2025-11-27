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
          "❌ No account found. Please visit salvageunion.io to sign up.",
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
    const embeds = pilots.slice(0, 10).map((pilot: any) => {
      const callsign = pilot.callsign || "Unnamed Pilot";
      const url = `https://salvageunion.io/dashboard/pilots/${pilot.id}`;
      
      // Format class names: show advanced class if present, otherwise show base class
      let classText = "";
      if (pilot.advanced_class_name) {
        classText = pilot.advanced_class_name;
      } else if (pilot.class_name) {
        classText = pilot.class_name;
      }

      // Build title with callsign and class names on the same line
      let title = callsign;
      if (classText) {
        title = `${callsign} // ${classText}`;
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setURL(url)
        .setColor(Colors.Green)
        .setFooter(embedFooterDetails)
        .setTimestamp();

      // Build stats fields (HP and AP)
      const statsFields: Array<{ name: string; value: string; inline: boolean }> = [];
      
      // HP (remaining HP / 10) = (10 - current damage)
      const currentDamage = pilot.current_damage ?? 0;
      const remainingHP = 10 - currentDamage;
      statsFields.push({
        name: "HP",
        value: `${remainingHP} / 10`,
        inline: true,
      });
      
      // AP (current_ap / max_ap)
      const currentAP = pilot.current_ap ?? 0;
      const maxAP = pilot.max_ap ?? "?";
      statsFields.push({
        name: "AP",
        value: `${currentAP} / ${maxAP}`,
        inline: true,
      });

      if (statsFields.length > 0) {
        embed.addFields(statsFields);
      }

      // Add abilities field below stats (with links)
      const abilities = pilot.abilities || [];
      if (abilities.length > 0) {
        const abilityLinks = abilities.map((ability: { name: string; id: string }) => {
          const url = `https://salvageunion.io/schema/abilities/item/${ability.id}`;
          return `[${ability.name}](${url})`;
        });
        embed.addFields({
          name: "ABILITIES",
          value: abilityLinks.join("\n"),
          inline: false,
        });
      }

      // Build description with motto only
      if (pilot.motto) {
        embed.setDescription(`*"${pilot.motto}"*`);
      }

      // Set thumbnail if available (user image or fallback to class asset_url)
      // Thumbnail appears in top right, near the title
      if (pilot.image_url) {
        embed.setThumbnail(pilot.image_url);
      }

      return embed;
    });

    // If there are more than 10 pilots, add a note
    if (pilots.length > 10) {
      const lastEmbed = embeds[embeds.length - 1];
      const embedData = lastEmbed.toJSON();
      const currentDescription = embedData.description || "";
      const note = `*Showing 10 of ${pilots.length} pilots. Visit your dashboard to see all.*`;
      lastEmbed.setDescription(
        currentDescription ? `${currentDescription}\n\n${note}` : note
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

