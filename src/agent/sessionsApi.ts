import { CommandsApi, type HealthResponse } from "@/agent/commandsApi";
import type { SessionRequest, SessionsResponse } from "./sessionModel";

export type {
  LiveSession,
  PersistedSession,
  SessionRequest,
  SessionsResponse,
} from "./sessionModel";
export { describeSession, isTmuxUsable, mergeSessions, nextSessionAction } from "./sessionModel";

export class SessionsApi {
  constructor(private readonly base: CommandsApi) {}

  list(): Promise<SessionsResponse> {
    return this.base.request<SessionsResponse>("/api/sessions");
  }

  health(): Promise<HealthResponse> {
    return this.base.health();
  }

  create(body: SessionRequest): Promise<{ id: string; mode: string; slug: string | null }> {
    return this.base.request<{ id: string; mode: string; slug: string | null }>("/api/session", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  kill(sessionId: string): Promise<{ status: string }> {
    return this.base.request<{ status: string }>(`/api/session/${encodeURIComponent(sessionId)}/kill`, {
      method: "POST",
    });
  }

  killPersisted(slug: string): Promise<{ status: string }> {
    return this.base.request<{ status: string }>(`/api/persisted/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
  }

  detach(sessionId: string): Promise<{ status: string; kept_alive: string | null }> {
    return this.base.request<{ status: string; kept_alive: string | null }>(
      `/api/session/${encodeURIComponent(sessionId)}/detach`,
      { method: "POST" },
    );
  }
}
