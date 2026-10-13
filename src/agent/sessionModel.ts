export interface LiveSession {
  id: string;
  mode: "pty" | "tmux";
  slug: string | null;
  cols: number;
  rows: number;
  attached: boolean;
  tmux_name: string | null;
}

export interface PersistedSession {
  name: string;
  slug: string;
  attached: number;
}

export interface SessionsResponse {
  live: LiveSession[];
  persisted: PersistedSession[];
  tmux_available: boolean;
  tmux_enabled: boolean;
  max_sessions: number;
}

export interface SessionRequest {
  cols: number;
  rows: number;
  mode: "pty" | "tmux";
  slug?: string;
  cwd?: string;
}

export function describeSession(session: LiveSession): string {
  if (session.mode === "tmux") {
    return session.attached ? "tmux · attached" : "tmux · detached";
  }
  return "pty · ephemeral";
}

export function nextSessionAction(session: LiveSession): "detach" | "kill" {
  return session.mode === "tmux" ? "detach" : "kill";
}

export function isTmuxUsable(health: Pick<SessionsResponse, "tmux_available" | "tmux_enabled">): boolean {
  return Boolean(health.tmux_available && health.tmux_enabled);
}

/**
 * The agent lists a slug once as live and again as persisted while it is attached.
 * Showing both makes a single session read as a duplicate, so drop the persisted
 * copy whenever a live row already owns the slug.
 */
export function mergeSessions(health: SessionsResponse): SessionsResponse {
  const liveSlugs = new Set(
    health.live.map((session) => session.slug).filter((slug): slug is string => Boolean(slug)),
  );
  return {
    ...health,
    persisted: health.persisted.filter((session) => !liveSlugs.has(session.slug)),
  };
}
