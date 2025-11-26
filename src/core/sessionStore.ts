// Simple in-memory store for Discord user ID -> Supabase session
// In production, consider using a database or Redis
interface SessionData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string; // Supabase user UUID
}

const sessions = new Map<string, SessionData>();

export function setSession(discordUserId: string, session: SessionData) {
  sessions.set(discordUserId, session);
}

export function getSession(discordUserId: string): SessionData | null {
  const session = sessions.get(discordUserId);
  if (!session) return null;

  // Check if expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(discordUserId);
    return null;
  }

  return session;
}

export function deleteSession(discordUserId: string) {
  sessions.delete(discordUserId);
}



