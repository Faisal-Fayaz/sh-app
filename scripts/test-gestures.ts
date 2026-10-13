import {
  applyCtrl,
  base64ToBytes,
  bytesToBase64,
  CTRL,
  CTRL_D,
  ESC,
  isAsciiLetter,
  keyBytes,
} from "../src/gestures/keys";
import {
  DEFAULT_GESTURE,
  mapGesture,
  mapSingleFingerPan,
  mapTwoFinger,
  type SwipeVector,
} from "../src/gestures/gestureMap";

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

function sw(dx: number, dy: number, pointers: number): SwipeVector {
  return { dx, dy, pointers };
}

const asBytes = (b64: string) => base64ToBytes(b64);

// --- key encoding -----------------------------------------------------------

assertEqual(asBytes(bytesToBase64(keyBytes("ctrl-c"))), [CTRL], "ctrl-c encodes to 0x03");
assertEqual(asBytes(bytesToBase64(keyBytes("ctrl-d"))), [CTRL_D], "ctrl-d encodes to 0x04");
assertEqual(asBytes(bytesToBase64(keyBytes("escape"))), [ESC], "escape encodes to 0x1b");
assertEqual(asBytes(bytesToBase64(keyBytes("up"))), [ESC, 0x5b, 0x41], "up encodes to CSI A");
assertEqual(asBytes(bytesToBase64(keyBytes("left"))), [ESC, 0x5b, 0x44], "left encodes to CSI D");
assertEqual(
  asBytes(bytesToBase64(keyBytes("page-up"))),
  [ESC, 0x5b, 0x35, 0x7e],
  "page-up encodes to CSI 5~",
);

assertEqual(bytesToBase64([]), "", "empty input encodes to empty string");
assertEqual(bytesToBase64([0]), "AA==", "single zero byte encodes with padding");
assertEqual(bytesToBase64([0xff, 0xfe]), "//4=", "high bytes round-trip through base64");
assertEqual(asBytes("//4="), [0xff, 0xfe], "high bytes decode back");
assertEqual(asBytes(bytesToBase64([1, 2, 3, 4, 5])), [1, 2, 3, 4, 5], "5-byte payload round-trips");

const multibyte = [...new TextEncoder().encode("héllo 世界")];
assertEqual(asBytes(bytesToBase64(multibyte)), multibyte, "UTF-8 payload round-trips");

// --- ctrl modifier ----------------------------------------------------------

assertEqual(applyCtrl([0x61]), [0x01], "ctrl+a is 0x01");
assertEqual(applyCtrl([0x7a]), [0x1a], "ctrl+z is 0x1a");
assertEqual(applyCtrl([0x41]), [0x01], "ctrl+shift+a is still 0x01");
assertEqual(applyCtrl([0x63]), [CTRL], "ctrl+c is 0x03");
assertEqual(applyCtrl([0x0d]), [CTRL_D], "ctrl+enter becomes ctrl-d");
assertEqual(applyCtrl([ESC]), [ESC], "ctrl+escape passes through unchanged");
assertTrue(isAsciiLetter(0x7a), "z is a letter");
assertTrue(!isAsciiLetter(0x31), "1 is not a letter");

// --- two-finger gestures ----------------------------------------------------

assertEqual(mapTwoFinger(sw(140, 10, 2)), { kind: "key", key: "right" }, "two-finger right sends right arrow");
assertEqual(mapTwoFinger(sw(-140, 10, 2)), { kind: "key", key: "left" }, "two-finger left sends left arrow");
assertEqual(mapTwoFinger(sw(0, 150, 2)), { kind: "key", key: "ctrl-d" }, "two-finger down sends ctrl-d");
assertEqual(mapTwoFinger(sw(0, -150, 2)), { kind: "key", key: "ctrl-c" }, "two-finger up sends ctrl-c");
assertEqual(mapTwoFinger(sw(10, 10, 2)), null, "tiny two-finger movement is ignored");
assertEqual(mapTwoFinger(sw(30, 0, 2)), null, "below-threshold horizontal swipe is ignored");
assertEqual(mapTwoFinger(sw(0, -30, 2)), null, "below-threshold vertical swipe is ignored");
assertEqual(mapTwoFinger(sw(140, 10, 1)), null, "one finger never triggers two-finger actions");

assertEqual(
  mapTwoFinger(sw(100, 120, 2)),
  { kind: "key", key: "ctrl-d" },
  "dominant axis wins on a diagonal two-finger swipe",
);

// --- single-finger pan ------------------------------------------------------

assertEqual(mapSingleFingerPan(sw(0, -120, 1)), { kind: "scroll", lines: 2 }, "swipe up scrolls back 2 lines");
assertEqual(mapSingleFingerPan(sw(0, 240, 1)), { kind: "scroll", lines: -4 }, "swipe down scrolls forward 4 lines");
assertEqual(mapSingleFingerPan(sw(0, 20, 1)), null, "small single-finger drag is not a scroll");
assertEqual(mapSingleFingerPan(sw(200, 10, 1)), null, "horizontal single-finger drag is not a scroll");

// --- dispatcher -------------------------------------------------------------

assertEqual(mapGesture(sw(140, 0, 2)), { kind: "key", key: "right" }, "dispatcher routes two-finger to keys");
assertEqual(mapGesture(sw(0, -120, 1)), { kind: "scroll", lines: 2 }, "dispatcher routes one-finger to scroll");

// --- config sensitivity -----------------------------------------------------

const tight = { threshold: 20, twoFingerThreshold: 20 };
assertEqual(mapTwoFinger(sw(40, 0, 2), tight), { kind: "key", key: "right" }, "smaller threshold accepts shorter swipe");
assertEqual(mapSingleFingerPan(sw(0, -40, 1), tight), { kind: "scroll", lines: 2 }, "tighter scroll threshold");
assertTrue(DEFAULT_GESTURE.threshold < DEFAULT_GESTURE.twoFingerThreshold, "two-finger threshold is stricter");

// --- end-to-end: gesture -> bytes the agent would receive --------------------

function bytesForAction(action: ReturnType<typeof mapGesture>): number[] | null {
  if (action === null) return null;
  if (action.kind === "scroll") return null;
  return keyBytes(action.key);
}

assertEqual(bytesForAction(mapTwoFinger(sw(-140, 0, 2))), [ESC, 0x5b, 0x44], "two-finger left produces left-arrow bytes");
assertEqual(bytesForAction(mapTwoFinger(sw(0, -150, 2))), [CTRL], "two-finger up produces ctrl-c bytes");
assertEqual(bytesForAction(mapTwoFinger(sw(0, 150, 2))), [CTRL_D], "two-finger down produces ctrl-d bytes");

for (const [label, detail] of failures) {
  console.log(`[FAIL] ${label}`);
}
console.log(`\n${passed}/${passed + failed} assertions passed`);
process.exit(failed === 0 ? 0 : 1);
