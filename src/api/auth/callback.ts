import { supabase } from "../../core/supabase.js";
import { setSession } from "../../core/sessionStore.js";

export default async (req: any, res: any) => {
  const { code, state, error: oauthError } = req.query || {};

  // Handle OAuth errors from Discord/Supabase
  if (oauthError) {
    console.error("OAuth error:", oauthError);
    res.status(400).send(`OAuth error: ${oauthError}`);
    return;
  }

  // state contains the Discord user ID (passed through Supabase)
  const discordUserId = state as string;

  if (!code) {
    res.status(400).send("Missing authorization code");
    return;
  }

  if (!discordUserId) {
    res.status(400).send("Missing state parameter (Discord user ID)");
    return;
  }

  try {
    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      code as string
    );

    if (error) {
      console.error("Failed to exchange code for session:", error);
      res.status(400).send(`Failed to exchange code: ${error.message}`);
      return;
    }

    if (!data.session) {
      console.error("No session returned from Supabase");
      res.status(400).send("No session returned from authentication");
      return;
    }

    // Store session linked to Discord user ID
    setSession(discordUserId, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at! * 1000, // Convert to milliseconds
      userId: data.user.id,
    });

    // Redirect to success page
    res.redirect("https://salvageunion.io/auth/success");
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).send("Internal server error");
  }
};

