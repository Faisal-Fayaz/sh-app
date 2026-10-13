import {
  describeSession,
  isTmuxUsable,
  mergeSessions,
  nextSessionAction,
  type LiveSession,
  type SessionsResponse,
} from "../src/agent/sessionModel";
let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passed++;
  else {
    failed++;
    failures.push(label);
  }
}
const session = (partial: Partial<LiveSession> & { mode: "pty" | "tmux" }): LiveSession => ({
  id: partial.id ?? "abc123",
  mode: partial.mode,
  slug: partial.slug ?? null,
  cols: partial.cols ?? 80,
  rows: partial.rows ?? 24,
  attached: partial.attached ?? true,
  tmux_name: partial.tmux_name ?? null,
});
check(
  describeSession(session({ mode: "pty" })).includes("ephemeral"),
  "a pty session is described as ephemeral",
);
check(
  describeSession(session({ mode: "tmux", slug: "deploy", attached: true })).includes("attached"),
  "an attached tmux session is described as attached",
);
check(
  describeSession(session({ mode: "tmux", slug: "deploy", attached: false })).includes("detached"),
  "a detached tmux session is described as detached",
);
check(nextSessionAction(session({ mode: "pty" })) === "kill", "a pty session is killed, not detached");
check(
  nextSessionAction(session({ mode: "tmux" })) === "detach",
  "a tmux session is detached rather than killed",
);
check(
  isTmuxUsable({ tmux_available: true, tmux_enabled: true }),
  "tmux is usable when installed and enabled",
);
check(
  !isTmuxUsable({ tmux_available: false, tmux_enabled: true }),
  "tmux is unusable when it is not installed",
);
check(
  !isTmuxUsable({ tmux_available: true, tmux_enabled: false }),
  "tmux is unusable when the agent has it disabled",
);
check(
  !isTmuxUsable({ tmux_available: false, tmux_enabled: false }),
  "tmux is unusable when both are off",
);

const listing = (
  live: LiveSession[],
  persisted: SessionsResponse["persisted"],
): SessionsResponse => ({
  live,
  persisted,
  tmux_available: true,
  tmux_enabled: true,
  max_sessions: 8,
});
const named = (slug: string, id: string): LiveSession => ({
  ...session({ mode: "tmux", slug }),
  id,
});
const stored = (slug: string, attached = 0): SessionsResponse["persisted"][number] => ({
  name: `sh-abc-${slug}`,
  slug,
  attached,
});
// The reported bug: tapping a session added a row every time, and the same slug showed
// up once live and once persisted.
const messy = mergeSessions(
  listing(
    [named("demo", "one"), named("demo", "two"), session({ mode: "pty" })],
    [stored("demo"), stored("other")],
  ),
);
// The agent guarantees one live row per slug, so the merge is only a safety net for
// persisted: it must not drop or reorder live rows.
check(messy.live.length === 3, "merging never drops live rows");
check(
  messy.live.map((s) => s.slug ?? "").join(",") === "demo,demo,",
  "merging preserves live row order",
);
check(
  messy.persisted.every((s) => s.slug !== "demo"),
  "a live slug is hidden from persisted",
);
check(messy.persisted.length === 1, "unrelated persisted rows survive the merge");
// Even against a well-behaved agent the app should not double-render.
const tidy = mergeSessions(listing([named("demo", "one")], [stored("other")]));
check(
  tidy.persisted.map((s) => s.slug).join(",") === "other",
  "distinct slugs pass through untouched",
);
// PTY sessions have no slug, so they must never be folded together.
const ptys = mergeSessions(
  listing([session({ mode: "pty" }), session({ mode: "pty" })], []),
);
check(ptys.live.length === 2, "unnamed pty sessions coexist");
check(ptys.persisted.length === 0, "pty sessions have nothing to merge against");
const empty = mergeSessions(listing([], [stored("solo")]));
check(empty.persisted.length === 1, "a detached-only session still shows");

console.log(`\n${passed}/${passed + failed} assertions passed`);
for (const label of failures) console.log(`[FAIL] ${label}`);

process.exit(failed === 0 ? 0 : 1);
