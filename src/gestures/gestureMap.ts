import type { NamedKey } from "./keys";

export type GestureAction =
  | { kind: "key"; key: NamedKey }
  | { kind: "scroll"; lines: number }
  | null;

export interface SwipeVector {
  dx: number;
  dy: number;
  pointers: number;
}

export interface GestureConfig {
  threshold: number;
  twoFingerThreshold: number;
}

export const DEFAULT_GESTURE: GestureConfig = {
  threshold: 56,
  twoFingerThreshold: 72,
};

function dominant(dx: number, dy: number): "horizontal" | "vertical" {
  return Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
}

/**
 * Two-finger gestures drive control keys, because a single finger is reserved for
 * text selection and scrollback.
 */
export function mapTwoFinger(vector: SwipeVector, config: GestureConfig = DEFAULT_GESTURE): GestureAction {
  const { dx, dy, pointers } = vector;
  if (pointers < 2) return null;

  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  const axis = dominant(dx, dy);

  if (axis === "horizontal") {
    if (horizontal < config.twoFingerThreshold) return null;
    return dx > 0 ? { kind: "key", key: "right" } : { kind: "key", key: "left" };
  }

  if (vertical < config.twoFingerThreshold) return null;
  return dy > 0 ? { kind: "key", key: "ctrl-d" } : { kind: "key", key: "ctrl-c" };
}

export function mapSingleFingerPan(vector: SwipeVector, config: GestureConfig = DEFAULT_GESTURE): GestureAction {
  const { dx, dy, pointers } = vector;
  if (pointers !== 1) return null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < config.threshold) return null;
  if (dominant(dx, dy) !== "vertical") return null;
  const lines = Math.round(Math.abs(dy) / config.threshold);
  return { kind: "scroll", lines: dy > 0 ? -lines : lines };
}

export function mapGesture(vector: SwipeVector, config: GestureConfig = DEFAULT_GESTURE): GestureAction {
  return vector.pointers >= 2 ? mapTwoFinger(vector, config) : mapSingleFingerPan(vector, config);
}

export interface GestureReferenceEntry {
  id: string;
  /** How the user performs it, in words. */
  label: string;
  /** What it does, in words. */
  outcome: string;
  /** The gesture that must produce `expected`, so a test can prove the table is honest. */
  sample: SwipeVector;
  expected: GestureAction;
}

/**
 * The gestures this app responds to, as data.
 *
 * The help screen renders from this table and the test suite replays `sample`
 * through `mapGesture` to confirm each `expected`. That is what keeps the
 * instructions from quietly describing behaviour that no longer exists -- the
 * failure mode of every hand-written gesture guide.
 */
export const GESTURE_REFERENCE: GestureReferenceEntry[] = [
  {
    id: "arrow-right",
    label: "Two-finger swipe right",
    outcome: "Moves the cursor right",
    sample: { dx: 120, dy: 0, pointers: 2 },
    expected: { kind: "key", key: "right" },
  },
  {
    id: "arrow-left",
    label: "Two-finger swipe left",
    outcome: "Moves the cursor left",
    sample: { dx: -120, dy: 0, pointers: 2 },
    expected: { kind: "key", key: "left" },
  },
  {
    id: "interrupt",
    label: "Two-finger swipe up",
    outcome: "Ctrl-C, to interrupt what is running",
    sample: { dx: 0, dy: -120, pointers: 2 },
    expected: { kind: "key", key: "ctrl-c" },
  },
  {
    id: "eof",
    label: "Two-finger swipe down",
    outcome: "Ctrl-D, end of input",
    sample: { dx: 0, dy: 120, pointers: 2 },
    expected: { kind: "key", key: "ctrl-d" },
  },
  {
    id: "scrollback",
    label: "One-finger drag up or down",
    outcome: "Scrolls the scrollback",
    sample: { dx: 0, dy: 120, pointers: 1 },
    expected: { kind: "scroll", lines: -2 },
  },
];
