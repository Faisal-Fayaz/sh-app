import {
  describeSession,
  isTmuxUsable,
  mergeSessions,
  nextSessionAction,
  targetForLiveSession,
  type LiveSession,
  type SessionsResponse,
} from "../src/agent/sessionModel";
import {
  clampFontSize,
  DEFAULT_FONT_SIZE,
  fontSizeFromScale,
  isZoomGesture,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
} from "../src/agent/fontSize";
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

// Tapping a row must switch to the session behind it, not mint a new one.
const liveTarget = targetForLiveSession({ ...session({ mode: "pty" }), id: "abc123def" });
check(liveTarget.sessionId === "abc123def", "a live row switches by session id");

const tmuxTarget = targetForLiveSession({
  ...session({ mode: "tmux", slug: "demo" }),
  id: "deadbeef",
});
check(tmuxTarget.sessionId === "deadbeef", "a live tmux row switches by id too");
check(tmuxTarget.slug === "demo", "the slug travels with the switch");
check(tmuxTarget.mode === "tmux", "the mode travels with the switch");

const namedTarget = targetForLiveSession({ ...session({ mode: "pty", slug: "x" }), id: "i" });
check(namedTarget.sessionId === "i", "a row with a slug still switches by id");

// Pinch zoom. Both it and the two-finger navigation gesture use two fingers, so the
// only thing separating them is whether the fingers changed distance.
check(clampFontSize(5) === MIN_FONT_SIZE, "font size cannot go below the floor");
check(clampFontSize(99) === MAX_FONT_SIZE, "font size cannot go above the ceiling");
check(clampFontSize(11.4) === 11, "font size rounds to whole pixels");
check(clampFontSize(Number.NaN) === DEFAULT_FONT_SIZE, "a nonsense size falls back to the default");
check(clampFontSize(DEFAULT_FONT_SIZE) === DEFAULT_FONT_SIZE, "the default is in range");

check(isZoomGesture(1) === false, "two fingers held still is not a zoom");
check(isZoomGesture(1.02) === false, "jitter while starting a drag is not a zoom");
check(isZoomGesture(1.09) === false, "a small drift is still a drag");
check(isZoomGesture(1.4) === true, "spreading the fingers is a zoom");
check(isZoomGesture(0.7) === true, "pinching the fingers together is a zoom");
check(isZoomGesture(0) === false, "a collapsed gesture is ignored");

check(fontSizeFromScale(13, 2) === MAX_FONT_SIZE, "zooming in stops at the ceiling");
check(fontSizeFromScale(13, 0.5) === MAX_FONT_SIZE - 1 || fontSizeFromScale(13, 0.5) === 8,
      "zooming out is clamped too");
check(fontSizeFromScale(13, 1.2) === 16, "zooming scales the current size");
check(fontSizeFromScale(13, 1) === 13, "no scale change keeps the size");

console.log(`\n${passed}/${passed + failed} assertions passed`);
for (const label of failures) console.log(`[FAIL] ${label}`);

process.exit(failed === 0 ? 0 : 1);
