import { AgentClient, type AgentFrame, type AgentStatus } from "../src/agent/AgentClient";

const HOST = process.env.SH_VERIFY_HOST ?? "127.0.0.1";
const PORT = Number(process.env.SH_VERIFY_PORT ?? 8765);
const TOKEN = process.env.SH_TOKEN ?? "";

const results: Array<{ ok: boolean; label: string; detail?: string }> = [];

function check(ok: boolean, label: string, detail = ""): void {
  results.push({ ok, label, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` -- ${detail}` : ""}`);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function b64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await delay(100);
  }
  return predicate();
}

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error("SH_TOKEN is required");
    process.exit(2);
  }

  const statuses: AgentStatus[] = [];
  const notices: string[] = [];
  const output: string[] = [];

  const client = new AgentClient({
    host: HOST,
    port: PORT,
    token: TOKEN,
    reconnectDelayMs: 200,
    maxReconnectDelayMs: 800,
    onFrame: (frame: AgentFrame) => {
      if (frame.type === "stdout" && frame.data) {
        output.push(Buffer.from(frame.data, "base64").toString("utf8"));
      }
    },
    onStatus: (status) => statuses.push(status),
    onNotice: (message) => notices.push(message),
  });

  await client.createSession(80, 24);
  const firstSession = client.currentSessionId;
  // The terminal measures itself before the socket exists, so this lands while nothing
  // can carry it and has to be replayed on open.
  client.sendResize(100, 40);
  client.connect();

  check(await waitUntil(() => statuses.includes("open"), 8000), "initial connect reaches open");

  client.sendStdin(b64("stty size\n"));
  check(
    await waitUntil(() => output.join("").includes("40 100"), 8000),
    "geometry measured before the socket opened is replayed on open",
    "expected \"40 100\" from stty size",
  );

  client.sendStdin(b64("echo FIRST-SHELL-OK\n"));
  check(
    await waitUntil(() => output.join("").includes("FIRST-SHELL-OK"), 8000),
    "stdin works on the first session",
  );

  check(firstSession !== null, "client knows its session id", String(firstSession));

  // A client built later -- on a session switch -- knows only the geometry it was
  // seeded with. Defaulting that to 80x24 shrinks the shell to a size nobody asked
  // for, and the terminal never re-reports its size because it did not change.
  const switched = new AgentClient({
    host: HOST,
    port: PORT,
    token: TOKEN,
    cols: 100,
    rows: 40,
    reconnectDelayMs: 200,
    onFrame: (frame: AgentFrame) => {
      if (frame.type === "stdout" && frame.data) {
        output.push(Buffer.from(frame.data, "base64").toString("utf8"));
      }
    },
    onStatus: (status) => statuses.push(status),
  });
  if (firstSession === null) throw new Error("expected a session id");
  switched.attachExisting(firstSession);
  switched.connect();
  check(
    await waitUntil(() => statuses.filter((s) => s === "open").length >= 2, 8000),
    "a client seeded with the real grid reconnects",
  );
  switched.sendStdin(b64("stty size\n"));
  check(
    await waitUntil(() => output.join("").includes("40 100"), 8000),
    "switching sessions replays the seeded size, not the 80x24 default",
  );
  switched.disconnect();

  // Simulate the agent reclaiming the session (detach grace expiring, or an explicit kill).
  const kill = await fetch(`http://${HOST}:${PORT}/api/session/${firstSession}/kill`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(kill.status === 200, "agent reclaimed the session out from under the client", String(kill.status));

  output.length = 0;

  const recovered = await waitUntil(
    () => client.currentSessionId !== null && client.currentSessionId !== firstSession,
    15000,
  );
  check(recovered, "client detected the dead session and started a new one", String(client.currentSessionId));
  check(client.currentSessionId !== firstSession, "the replacement session is genuinely different");

  check(
    await waitUntil(() => statuses.filter((s) => s === "open").length >= 2, 15000),
    "client reconnected and reported open again",
    statuses.join(" -> "),
  );

  check(notices.length > 0, "client told the user the shell was replaced", notices[0] ?? "(none)");
  check(
    notices[0]?.toLowerCase().includes("shell") ?? false,
    "the notice explains what happened",
    notices[0] ?? "",
  );

  client.sendStdin(b64("echo SECOND-SHELL-OK\n"));
  check(
    await waitUntil(() => output.join("").includes("SECOND-SHELL-OK"), 10000),
    "stdin works again on the replacement session",
  );

  client.disconnect();
  check(statuses[statuses.length - 1] === "closed", "disconnect surfaces a closed status", statuses[statuses.length - 1]);

  console.log("");
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log(`failed: ${failed.map((f) => f.label).join(", ")}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
