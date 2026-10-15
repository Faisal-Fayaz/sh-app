import { GESTURE_REFERENCE, DEFAULT_GESTURE, mapGesture } from "../src/gestures/gestureMap";
import { resolveSeenFlag } from "../src/storage/onboarding";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    failures.push(`${label}\n     expected ${e}\n     actual   ${a}`);
  }
}

function assertTrue(condition: boolean, label: string): void {
  if (condition) passed++;
  else {
    failed++;
    failures.push(label);
  }
}

// --- the help table is honest -----------------------------------------------
// Each documented gesture is replayed through the real mapper. If someone
// changes a threshold or swaps two directions, the guide starts lying and this
// is what notices.

for (const entry of GESTURE_REFERENCE) {
  assertEqual(
    mapGesture(entry.sample, DEFAULT_GESTURE),
    entry.expected,
    `"${entry.label}" performs what the help screen promises`,
  );
  assertTrue(entry.label.trim().length > 0, `"${entry.id}" has a label to show`);
  assertTrue(entry.outcome.trim().length > 0, `"${entry.id}" has an outcome to show`);
}

const ids = GESTURE_REFERENCE.map((entry) => entry.id);
assertEqual(new Set(ids).size, ids.length, "gesture ids are unique, so React keys are stable");

// The directions are the part most likely to be silently inverted, so pin the
// two that mean "interrupt" and "end input" apart from each other.
const interrupt = GESTURE_REFERENCE.find((entry) => entry.id === "interrupt");
const eof = GESTURE_REFERENCE.find((entry) => entry.id === "eof");
assertEqual(interrupt?.expected, { kind: "key", key: "ctrl-c" }, "swiping up interrupts");
assertEqual(eof?.expected, { kind: "key", key: "ctrl-d" }, "swiping down ends input");

// A one-finger vertical drag must scroll rather than being read as a key, which
// is the boundary the whole two-finger design rests on.
const scroll = GESTURE_REFERENCE.find((entry) => entry.id === "scrollback");
assertEqual(scroll?.expected?.kind ?? null, "scroll", "one finger scrolls instead of sending a key");

// --- first-run flags --------------------------------------------------------

// Nothing stored, never paired: a genuine first run, so the tour is due.
assertEqual(resolveSeenFlag(null, false), false, "a fresh install sees the walkthrough");

// Nothing stored, already paired: an install from before the flags existed.
// Telling this user how to install the agent would be absurd.
assertEqual(resolveSeenFlag(null, true), true, "an install predating the flags skips it");

// Explicit values always win, in both directions. A user who has seen it is not
// shown it again just because they are now connected, and one who has not is
// not skipped just because a token happens to be present.
assertEqual(resolveSeenFlag("true", false), true, "an explicit true holds when unpaired");
assertEqual(resolveSeenFlag("false", true), false, "an explicit false holds when paired");

// Anything that is not exactly "true" is treated as unseen, so a corrupted or
// unexpected value shows the tour rather than hiding it forever.
assertEqual(resolveSeenFlag("yes", true), false, "an unrecognised value is not read as seen");
assertEqual(resolveSeenFlag("", true), false, "an empty string is not read as seen");
assertEqual(resolveSeenFlag("TRUE", true), false, "the flag is compared case-sensitively");

if (failed > 0) {
  console.error(`\n${failed} failed:\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}\n`);
}
console.log(`onboarding: ${passed}/${passed + failed} checks passed`);
process.exit(failed > 0 ? 1 : 0);
