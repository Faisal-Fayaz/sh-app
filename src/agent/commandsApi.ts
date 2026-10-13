export interface PaletteEntry {
  id: string;
  name: string;
  command: string[];
  group: string;
  builtin: boolean;
  description: string | null;
}

export interface CommandsResponse {
  count: number;
  entries: PaletteEntry[];
  groups: Record<string, PaletteEntry[]>;
}

export interface HealthResponse {
  status: string;
  protocol: number;
  version: string;
  sessions: number;
  max_sessions: number;
  shell: string;
  write_enabled: boolean;
  tailscale_available: boolean;
  tailscale_required: boolean;
  bind: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }

  get isWriteDisabled(): boolean {
    return this.status === 403;
  }
}

export class CommandsApi {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly token: string,
    private readonly writeToken: string = "",
  ) {}

  private url(path: string): string {
    return `http://${this.host}:${this.port}${path}`;
  }

  private async request<T>(path: string, init?: RequestInit & { auth?: string }): Promise<T> {
    const bearer = init?.auth ?? this.token;
    const response = await fetch(this.url(path), {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${bearer}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new ApiError(await safeText(response), response.status);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  list(): Promise<CommandsResponse> {
    return this.request<CommandsResponse>("/api/commands");
  }

  create(input: {
    name: string;
    command: string[] | string;
    group?: string;
    description?: string;
  }): Promise<PaletteEntry> {
    return this.request<PaletteEntry>("/api/commands", {
      method: "POST",
      body: JSON.stringify(input),
      auth: this.writeToken || this.token,
    });
  }

  update(
    id: string,
    changes: Partial<Pick<PaletteEntry, "name" | "group" | "description">> & { command?: string[] | string },
  ): Promise<PaletteEntry> {
    return this.request<PaletteEntry>(`/api/commands/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
      auth: this.writeToken || this.token,
    });
  }

  remove(id: string): Promise<void> {
    return this.request<void>(`/api/commands/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: this.writeToken || this.token,
    });
  }

  get canWrite(): boolean {
    return this.writeToken.length > 0;
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    return JSON.stringify(body);
  } catch {
    return response.statusText || `request failed (${response.status})`;
  }
}

export function commandLine(entry: PaletteEntry): string {
  return entry.command.map(quoteIfNeeded).join(" ");
}

function quoteIfNeeded(part: string): string {
  if (part.length === 0) return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(part)) return part;
  return `'${part.replace(/'/g, `'\\''`)}'`;
}

export interface PaletteGroup {
  name: string;
  entries: PaletteEntry[];
}

const GROUP_ORDER = ["system", "docker", "git", "dev", "ops", "general"];

export function groupEntries(entries: PaletteEntry[]): PaletteGroup[] {
  const byGroup = new Map<string, PaletteEntry[]>();
  for (const entry of entries) {
    const key = entry.group || "general";
    const bucket = byGroup.get(key);
    if (bucket) bucket.push(entry);
    else byGroup.set(key, [entry]);
  }
  const names = [...byGroup.keys()];
  names.sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return names.map((name) => ({ name, entries: byGroup.get(name) as PaletteEntry[] }));
}

export function filterEntries(entries: PaletteEntry[], query: string): PaletteEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => {
    if (entry.name.toLowerCase().includes(needle)) return true;
    if (entry.group.toLowerCase().includes(needle)) return true;
    if (entry.description && entry.description.toLowerCase().includes(needle)) return true;
    return entry.command.join(" ").toLowerCase().includes(needle);
  });
}

export function runPayload(entry: PaletteEntry): string {
  return `${commandLine(entry)}\n`;
}
