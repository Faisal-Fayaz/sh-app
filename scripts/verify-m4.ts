import { ApiError, CommandsApi } from "../src/agent/commandsApi";

const HOST = process.env.SH_VERIFY_HOST ?? "127.0.0.1";
const PORT = Number(process.env.SH_VERIFY_PORT ?? 8765);
const TOKEN = process.env.SH_TOKEN ?? "";
const WRITE_TOKEN = process.env.SH_WRITE_TOKEN ?? "";

const results: Array<{ ok: boolean; label: string; detail?: string }> = [];

function check(ok: boolean, label: string, detail = ""): void {
  results.push({ ok, label, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` -- ${detail}` : ""}`);
}

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error("SH_TOKEN is required");
    process.exit(2);
  }

  const readOnly = new CommandsApi(HOST, PORT, TOKEN);
  const writable = new CommandsApi(HOST, PORT, TOKEN, WRITE_TOKEN);

  check(readOnly.canWrite === false, "client without a write token reports read-only");
  if (WRITE_TOKEN.length > 0) {
    check(writable.canWrite === true, "client with a write token reports writable");
  }

  const health = await readOnly.health();
  check(health.status === "ok", "health reachable");
  check(health.write_enabled === (WRITE_TOKEN.length > 0), "health write_enabled matches the agent", String(health.write_enabled));

  const list = await readOnly.list();
  check(list.entries.length > 0, "list returns entries", `${list.count}`);
  check(Object.keys(list.groups).length > 0, "list returns groups", Object.keys(list.groups).join(","));

  try {
    await readOnly.create({ name: "should-not-work", command: ["true"] });
    check(false, "create without a write token is rejected");
  } catch (err) {
    const rejected = err instanceof ApiError && err.status === 403 && err.isWriteDisabled;
    check(rejected, "create without a write token is rejected 403", err instanceof Error ? err.message : "");
  }

  if (WRITE_TOKEN.length === 0) {
    console.log("");
    console.log("SH_WRITE_TOKEN not set; skipping mutation checks");
    console.log(`${results.filter((r) => r.ok).length}/${results.length} checks passed`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }

  const created = await writable.create({
    name: "verify entry",
    command: "echo client-round-trip",
    group: "verify",
  });
  check(created.name === "verify entry", "create returns the new entry", created.id);
  check(created.command.join(" ") === "echo client-round-trip", "string command is parsed into argv", created.command.join(" "));
  check(created.builtin === false, "created entry is not built-in");

  const afterCreate = await readOnly.list();
  check(afterCreate.entries.some((e) => e.id === created.id), "created entry appears in a fresh list");

  const patched = await writable.update(created.id, { name: "verify entry renamed", group: "verify2" });
  check(patched.name === "verify entry renamed", "patch renames the entry");
  check(patched.group === "verify2", "patch changes the group");

  try {
    await writable.update("does-not-exist", { name: "nope" });
    check(false, "patching a missing entry fails");
  } catch (err) {
    check(err instanceof ApiError && err.status === 404, "patching a missing entry returns 404", err instanceof Error ? err.message : "");
  }

  const shadowed = list.entries.find((e) => !e.builtin && e.name === "uptime");
  if (shadowed) {
    const shadowUpdate = await writable.update(shadowed.id, { group: "hijacked" });
    check(shadowUpdate.group === "hijacked", "a user entry may shadow a built-in by name", shadowUpdate.group);
    await writable.update(shadowed.id, { group: shadowed.group });
  } else {
    check(true, "a user entry may shadow a built-in by name (skipped, nothing shadowed)");
  }

  try {
    await writable.update("builtin:docker", { name: "hijack" });
    check(false, "built-in entries cannot be patched");
  } catch (err) {
    check(err instanceof ApiError && err.status === 400, "built-in entries cannot be patched", err instanceof Error ? err.message : "");
  }

  await writable.remove(created.id);
  const afterDelete = await readOnly.list();
  check(!afterDelete.entries.some((e) => e.id === created.id), "delete removes the entry");

  try {
    await writable.remove(created.id);
    check(false, "deleting a missing entry fails");
  } catch (err) {
    check(err instanceof ApiError && err.status === 404, "deleting a missing entry returns 404");
  }

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
