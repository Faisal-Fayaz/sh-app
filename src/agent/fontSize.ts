export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 20;
export const DEFAULT_FONT_SIZE = 13;

export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)));
}

/** How much the text has to change before a pinch counts as zoom rather than a drag. */
export const PINCH_ENGAGE_SCALE = 1.12;

/**
 * Decide whether a gesture is a zoom.
 *
 * Both are two-finger gestures, so they are told apart by what the fingers do: a pinch
 * changes the distance between them, a drag slides them across the screen together.
 * Without a threshold, any jitter while starting a scroll-back drag would change the
 * font size, which is worse than having no zoom at all.
 */
export function isZoomGesture(scale: number): boolean {
  if (!Number.isFinite(scale) || scale <= 0) return false;
  return scale >= PINCH_ENGAGE_SCALE || scale <= 1 / PINCH_ENGAGE_SCALE;
}

export function fontSizeFromScale(startSize: number, scale: number): number {
  return clampFontSize(startSize * scale);
}
