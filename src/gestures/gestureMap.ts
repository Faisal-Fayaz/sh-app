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
