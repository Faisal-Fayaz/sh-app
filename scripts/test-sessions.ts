import {
  describeSession,
  isTmuxUsable,
  nextSessionAction,
  type LiveSession,
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

for (const label of failures) console.log(`[FAIL] ${label}`);
console.log(`\n${passed}/${passed + failed} assertions passed`);
process.exit(failed === 0 ? 0 : 1);