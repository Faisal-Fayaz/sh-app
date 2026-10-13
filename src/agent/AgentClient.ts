export type AgentStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed" | "error";

export interface AgentFrame {
  type: string;
  seq?: number;
  data?: string;
  cols?: number;
  rows?: number;
  shell?: string;
  session_id?: string;
  code?: number;
  message?: string;
}

export interface AgentClientOptions {
  host: string;
  /**
   * Geometry to replay when the socket opens. A fresh client would otherwise assume
   * 80x24, which is what the terminal used to fall back to.
   */
  cols?: number;
  rows?: number;
  port: number;
  token: string;
  onFrame: (frame: AgentFrame) => void;
  onStatus: (status: AgentStatus, detail?: string) => void;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  onNotice?: (message: string) => void;
}

export function normalizeHost(input: string): string {
  return input.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function wsUrl(host: string, port: number, sessionId: string, token: string, resume?: number | null): string {
  const resumeQuery = resume == null ? "" : `&resume=${resume}`;
  return `ws://${host}:${port}/ws/${sessionId}?token=${encodeURIComponent(token)}${resumeQuery}`;
}

export class AgentClient {
  private socket: WebSocket | null = null;
  private sessionId: string | null = null;
  private resumeOffset: number | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private lastCols: number;
  private lastRows: number;

  constructor(private readonly options: AgentClientOptions) {
    this.reconnectDelayMs = options.reconnectDelayMs ?? 700;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 8000;
    this.lastCols = options.cols ?? 80;
    this.lastRows = options.rows ?? 24;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  get currentResumeOffset(): number | null {
    return this.resumeOffset;
  }

  async createSession(
    cols: number,
    rows: number,
    target?: { mode?: "pty" | "tmux"; slug?: string },
  ): Promise<{ id: string; shell: string; mode: string; slug: string | null }> {
    const response = await fetch(`http://${this.options.host}:${this.options.port}/api/session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cols,
        rows,
        mode: target?.mode ?? "pty",
        ...(target?.slug ? { slug: target.slug } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`create session failed: ${response.status} ${await safeText(response)}`);
    }
    this.lastCols = cols;
    this.lastRows = rows;
    const body = (await response.json()) as { id: string; shell: string; mode: string; slug: string | null };
    this.sessionId = body.id;
    this.resumeOffset = null;
    return body;
  }

  connect(): void {
    this.stopped = false;
    this.attempt = 0;
    this.openSocket();
  }

  /**
   * Point this client at a session the agent is already holding.
   *
   * Creating a new session is the wrong move when switching between ones that are
   * already open: it leaves the old one behind and, for an unnamed shell, produces a
   * duplicate row every tap. Reconnecting to the id resumes that exact session instead.
   */
  attachExisting(sessionId: string, resumeOffset: number | null = null): void {
    this.sessionId = sessionId;
    this.resumeOffset = resumeOffset;
  }

  get attemptCount(): number {
    return this.attempt;
  }

  disconnect(): void {
    this.stopped = true;
    this.clearTimer();
    this.socket?.close();
    this.socket = null;
    this.options.onStatus("closed");
  }

  sendStdin(base64: string): void {
    this.send({ type: "stdin", data: base64 });
  }

  sendResize(cols: number, rows: number): void {
    this.lastCols = cols;
    this.lastRows = rows;
    this.send({ type: "resize", cols, rows });
  }

  sendKill(): void {
    this.send({ type: "kill" });
  }

  private send(payload: Record<string, unknown>): void {
    if (this.socket?.readyState === 1) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  private openSocket(): void {
    if (!this.sessionId) {
      this.options.onStatus("error", "no session");
      return;
    }
    const hadSession = this.resumeOffset !== null;
    this.options.onStatus(hadSession ? "reconnecting" : "connecting");

    const socket = new WebSocket(
      wsUrl(this.options.host, this.options.port, this.sessionId, this.options.token, this.resumeOffset),
    );
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.options.onStatus("open");
      // The terminal measures itself before the socket exists, so its first resize was
      // dropped. Re-send the geometry we know, or the remote shell keeps rendering for
      // the default 80x24 inside whatever viewport we actually have.
      if (this.lastCols > 0 && this.lastRows > 0) {
        this.send({ type: "resize", cols: this.lastCols, rows: this.lastRows });
      }
    };

    socket.onmessage = (event) => {
      let frame: AgentFrame;
      try {
        frame = JSON.parse(String(event.data)) as AgentFrame;
      } catch {
        return;
      }
      if (frame.type === "stdout" && typeof frame.seq === "number") {
        this.resumeOffset = frame.seq;
      }
      if (frame.type === "exit") {
        this.sessionId = null;
        this.resumeOffset = null;
      }
      this.options.onFrame(frame);
    };

    // A WebSocket always fires error then close when a connection fails, so the close
    // handler is where the outcome is decided. Reporting an error here as well would
    // flash a failure banner on every retry of a merely unreachable host.
    socket.onerror = () => {};

    socket.onclose = (event) => {
      this.socket = null;
      if (this.stopped) return;

      if (event.code === 4404) {
        this.resumeOffset = null;
        void this.respawn("The agent had already reclaimed that shell, so a new one was started.");
        return;
      }

      if (this.sessionId === null) {
        this.options.onStatus("closed", `session ended (${event.code})`);
        return;
      }

      // The agent refused our credentials. Retrying cannot fix that, and hammering a
      // host that will keep saying no is pointless -- tell the user what to change.
      if (event.code === 4401 || event.code === 4403) {
        this.options.onStatus(
          "error",
          "The agent rejected this token. Check the token and port in Settings.",
        );
        return;
      }

      this.scheduleReconnect();
    };
  }

  /** Abandon the backoff and try immediately, for a user-initiated Retry. */
  retryNow(): void {
    if (this.stopped || !this.sessionId) return;
    this.clearTimer();
    this.attempt = 0;
    this.openSocket();
  }

  private async respawn(notice: string): Promise<void> {
    if (this.stopped) return;
    this.options.onStatus("connecting", "reconnecting to the agent");
    try {
      await this.createSession(this.lastCols, this.lastRows);
    } catch (err) {
      if (this.stopped) return;
      this.options.onStatus("error", err instanceof Error ? err.message : String(err));
      return;
    }
    if (this.stopped) return;
    this.attempt = 0;
    this.options.onNotice?.(notice);
    this.openSocket();
  }

  private scheduleReconnect(): void {
    this.attempt += 1;
    const delay = Math.min(this.maxReconnectDelayMs, this.reconnectDelayMs * 2 ** Math.min(this.attempt - 1, 10));
    this.clearTimer();

    // A host that is merely asleep or out of range comes back on its own, so this
    // never gives up. Only a rejected token does, and that is handled above. Over
    // cellular a single tower handoff is enough to blow through a short budget, which
    // used to leave the app dead until the user reconnected by hand.
    const endpoint = `${this.options.host}:${this.options.port}`;
    this.options.onStatus(
      "reconnecting",
      this.attempt >= 3
        ? `Still trying to reach ${endpoint} (${this.attempt} tries). It may be asleep or out of range.`
        : `retrying in ${Math.round(delay / 100) / 10}s`,
    );

    this.timer = setTimeout(() => this.openSocket(), delay);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
