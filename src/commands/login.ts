import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import type { CommandConfig, CommandResult } from "robo.js";
import { embedFooterDetails } from "../core/constants";
import { supabase } from "../core/supabase";

export const config: CommandConfig = {
  description: "Link your Discord account to Salvage Union",
};

export default async (
  interaction: ChatInputCommandInteraction
): Promise<CommandResult> => {
  // Generate OAuth URL with Discord provider
  // redirectTo is where Supabase redirects AFTER processing the OAuth callback
  // This URL must be added to Supabase's redirect allow list in the dashboard
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: process.env.BOT_CALLBACK_URL,
      queryParams: {
        // Pass Discord user ID as state so we can link it after auth
        // State is used by OAuth for security and to pass custom data
        state: interaction.user.id,
      },
    },
  });

  if (error || !data.url) {
    const errorEmbed = new EmbedBuilder()
      .setTitle("Login Error")
      .setDescription("Failed to generate login link. Please try again later.")
      .setColor(Colors.Red)
      .setFooter(embedFooterDetails);

    await interaction.reply({
      embeds: [errorEmbed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  // Remove redirect_to parameter from the URL as Discord doesn't recognize it
  // Supabase uses redirect_uri for Discord, and redirect_to is only for Supabase's internal redirect

  const embed = new EmbedBuilder()
    .setTitle("Link Your Account")
    .setDescription(
      `Click the link below to link your Discord account to Salvage Union:\n\n[**Click here to login**](${data.url.toString()})`
    )
    .setColor(Colors.Blue)
    .setFooter(embedFooterDetails);

  await interaction.reply({ embeds: [embed.toJSON()], ephemeral: true });
};
