/**
 * Shared timing for move animations, so the 3D cube and the facelet graph
 * compute the same eased progress from the same start time.
 */
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/** Linear progress in [0, 1] of a tween that began at `start` (performance.now() ms) */
export function tweenProgress(now, start, durationMs) {
  if (durationMs <= 0) return 1;
  return Math.min(Math.max((now - start) / durationMs, 0), 1);
}
