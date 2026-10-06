/** Small 3D vector helpers for the puzzle geometry engine */

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a) => scale(a, 1 / length(a));
export const lerp = (a, b, t) => add(a, scale(sub(b, a), t));
export const distance = (a, b) => length(sub(a, b));
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];

/** Rotate p by `angle` (right-hand rule) about the unit axis u through the origin (Rodrigues) */
export function rotate(p, u, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const k = dot(u, p) * (1 - c);
  const x = cross(u, p);
  return [
    p[0] * c + x[0] * s + u[0] * k,
    p[1] * c + x[1] * s + u[1] * k,
    p[2] * c + x[2] * s + u[2] * k,
  ];
}

/**
 * Points on the arc of the circle with `center` and radius |from − center|,
 * lying in the plane spanned by `from`, `to` around `center`, going the short
 * way from `from` to `to` (both included).
 */
export function arc(center, from, to, steps) {
  const a = sub(from, center), b = sub(to, center);
  const r = length(a);
  const ua = normalize(a);
  // in-plane unit vector perpendicular to ua, on b's side
  const perp = normalize(sub(b, scale(ua, dot(b, ua))));
  const theta = Math.acos(Math.max(-1, Math.min(1, dot(ua, normalize(b)))));
  const pts = [];
  for (let k = 0; k <= steps; k++) {
    const t = (theta * k) / steps;
    pts.push(add(center, add(scale(ua, r * Math.cos(t)), scale(perp, r * Math.sin(t)))));
  }
  return pts;
}
