export {}
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_OPTIONS: string
      DISCORD_CLIENT_ID: string
      DISCORD_TOKEN: string
      SUPABASE_URL: string
      SUPABASE_ANON_KEY: string
      SUPABASE_SERVICE_ROLE_KEY?: string
    }
  }
}
