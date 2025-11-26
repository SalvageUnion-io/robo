-- Create function to get user ID by Discord ID
-- This function allows access to auth.identities table which is not directly accessible via PostgREST
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.get_user_by_discord_id(discord_id TEXT)
RETURNS UUID AS $$
DECLARE
  found_user_id UUID;
BEGIN
  SELECT i.user_id INTO found_user_id
  FROM auth.identities i
  WHERE i.provider = 'discord'
    AND (i.identity_data->>'sub' = discord_id OR i.identity_data->>'id' = discord_id)
  LIMIT 1;
  
  RETURN found_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anon roles (needed for service role)
GRANT EXECUTE ON FUNCTION public.get_user_by_discord_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_by_discord_id(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_by_discord_id(TEXT) TO service_role;

