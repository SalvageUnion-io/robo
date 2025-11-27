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
          "❌ No account found. Please visit salvageunion.io to sign up.",
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

    // Helper function to format lists with duplicate counting and links
    const formatListWithCounts = (
      items: Array<{ name: string; id: string }>,
      schemaType: "systems" | "modules" | "abilities"
    ): string[] => {
      const counts = new Map<string, number>();
      items.forEach((item) => {
        counts.set(item.name, (counts.get(item.name) || 0) + 1);
      });

      const formatted: string[] = [];
      const seen = new Set<string>();
      items.forEach((item) => {
        if (!seen.has(item.name)) {
          seen.add(item.name);
          const count = counts.get(item.name) || 1;
          const url = `https://salvageunion.io/schema/${schemaType}/item/${item.id}`;
          const link = `[${item.name}](${url})`;
          if (count > 1) {
            formatted.push(`${link} x${count}`);
          } else {
            formatted.push(link);
          }
        }
      });
      return formatted;
    };

    // Create individual embeds for each mech (Discord limit: 10 embeds per message)
    const embeds = mechs.slice(0, 10).map((mech: any) => {
      const chassisName = mech.chassis_name || "Unknown Chassis";
      const patternName = mech.pattern_name || "Unknown Pattern";
      const title = `"${patternName}" (${chassisName})`;
      const url = `https://salvageunion.io/dashboard/mechs/${mech.id}`;
      
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setURL(url)
        .setColor(Colors.Purple)
        .setFooter(embedFooterDetails)
        .setTimestamp();

      // Set thumbnail if available (user image or fallback to chassis asset_url)
      // Thumbnail appears in top right, near the title
      if (mech.image_url) {
        embed.setThumbnail(mech.image_url);
      }

      // Build stats fields (first row: TL, SP, EP)
      const statsFields: Array<{ name: string; value: string; inline: boolean }> = [];
      
      // TL (Chassis Tech Level) - from reference data only
      const techLevel = mech.chassis_tech_level ?? "?";
      statsFields.push({
        name: "TL",
        value: String(techLevel),
        inline: true,
      });
      
      // SP (remaining SP / chassis SP) = (chassis max SP - current damage)
      const currentDamage = mech.current_damage ?? 0;
      const maxSP = mech.chassis_structure_points;
      if (maxSP !== undefined && maxSP !== null) {
        const remainingSP = maxSP - currentDamage;
        statsFields.push({
          name: "SP",
          value: `${remainingSP} / ${maxSP}`,
          inline: true,
        });
      } else {
        statsFields.push({
          name: "SP",
          value: `? / ?`,
          inline: true,
        });
      }
      
      // EP (mech current ep / chassis EP)
      const currentEP = mech.current_ep ?? 0;
      const maxEP = mech.chassis_energy_points ?? "?";
      statsFields.push({
        name: "EP",
        value: `${currentEP} / ${maxEP}`,
        inline: true,
      });
      
      // Second row: Heat, SYS SLOTS, MOD SLOTS
      // Heat (mech current heat / chassis max heat)
      const currentHeat = mech.current_heat ?? 0;
      const maxHeat = mech.chassis_heat_capacity ?? "?";
      statsFields.push({
        name: "Heat",
        value: `${currentHeat} / ${maxHeat}`,
        inline: true,
      });
      
      // SYS SLOTS (# of systems installed / chassis systemSlots)
      const systems = mech.systems || [];
      const installedSystems = systems.length;
      const maxSystemSlots = mech.chassis_system_slots ?? "?";
      statsFields.push({
        name: "SYS SLOTS",
        value: `${installedSystems} / ${maxSystemSlots}`,
        inline: true,
      });
      
      // MOD SLOTS (# of modules installed / chassis moduleSlots)
      const modules = mech.modules || [];
      const installedModules = modules.length;
      const maxModuleSlots = mech.chassis_module_slots ?? "?";
      statsFields.push({
        name: "MOD SLOTS",
        value: `${installedModules} / ${maxModuleSlots}`,
        inline: true,
      });
      
      embed.addFields(statsFields);

      // Build fields for systems and modules (side by side)
      const systemModuleFields: Array<{ name: string; value: string; inline: boolean }> = [];
      
      if (systems.length > 0) {
        const formattedSystems = formatListWithCounts(systems, "systems");
        systemModuleFields.push({
          name: "SYSTEMS",
          value: formattedSystems.join("\n"),
          inline: true,
        });
      }
      
      if (modules.length > 0) {
        const formattedModules = formatListWithCounts(modules, "modules");
        systemModuleFields.push({
          name: "MODULES",
          value: formattedModules.join("\n"),
          inline: true,
        });
      }

      if (systemModuleFields.length > 0) {
        embed.addFields(systemModuleFields);
      }

      return embed;
    });

    // If there are more than 10 mechs, add a note
    if (mechs.length > 10) {
      const lastEmbed = embeds[embeds.length - 1];
      const embedData = lastEmbed.toJSON();
      const currentDescription = embedData.description || "";
      const note = `*Showing 10 of ${mechs.length} mechs. Visit your dashboard to see all.*`;
      lastEmbed.setDescription(
        currentDescription ? `${currentDescription}\n\n${note}` : note
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

