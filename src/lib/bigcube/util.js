/**
 * Small search toolkit shared by the big-cube solvers: sets of up to 24
 * slots as bit masks, their ranks, move tables for masks, breadth-first
 * distance tables and iterative-deepening A*.
 */

export const BINOM = Array.from({ length: 25 }, () => new Int32Array(25));
for (let n = 0; n <= 24; n++) {
  BINOM[n][0] = 1;
  for (let k = 1; k <= n; k++) BINOM[n][k] = BINOM[n - 1][k - 1] + (k <= n - 1 ? BINOM[n - 1][k] : 0);
}

/** Colex rank of a mask among masks with the same number of bits */
export function rankMask(mask) {
  let r = 0, k = 0;
  while (mask) {
    const low = mask & -mask;
    k++;
    r += BINOM[31 - Math.clz32(low)][k];
    mask ^= low;
  }
  return r;
}

/** Rank of every n-bit mask with k bits set (−1 for other masks) */
export function rankTable(n, k) {
  const out = new Int32Array(1 << n).fill(-1);
  for (let m = 0; m < 1 << n; m++) {
    let bits = 0;
    for (let b = m; b; b &= b - 1) bits++;
    if (bits === k) out[m] = rankMask(m);
  }
  return out;
}
export const RANK8 = rankTable(8, 4);

/** The bits of `mask` at `slots`, packed into a mask of slots.length bits */
export function compress(mask, slots) {
  let out = 0;
  for (let k = 0; k < slots.length; k++) if (mask & (1 << slots[k])) out |= 1 << k;
  return out;
}

/**
 * Byte tables moving a mask of up to 24 slots by a permutation given as
 * fwd[old slot] = new slot: three lookups move a whole mask.
 */
export function maskTable(fwd) {
  const t = new Int32Array(3 * 256);
  for (let chunk = 0; chunk < 3; chunk++) {
    for (let v = 0; v < 256; v++) {
      let out = 0;
      for (let b = 0; b < 8; b++) if (v & (1 << b) && chunk * 8 + b < fwd.length) out |= 1 << fwd[chunk * 8 + b];
      t[chunk * 256 + v] = out;
    }
  }
  return t;
}
export const applyMask = (t, mask) => t[mask & 255] | t[256 + ((mask >> 8) & 255)] | t[512 + ((mask >> 16) & 255)];

/** Exact distances from the start states, by breadth-first search (255 = unreachable) */
export function bfs(size, starts, index, neighbours) {
  const dist = new Uint8Array(size).fill(255);
  let frontier = [];
  for (const s of starts) { const i = index(s); if (dist[i] === 255) { dist[i] = 0; frontier.push(s); } }
  for (let d = 0; frontier.length; d++) {
    const next = [];
    for (const s of frontier) {
      for (const n of neighbours(s)) {
        const i = index(n);
        if (dist[i] === 255) { dist[i] = d + 1; next.push(n); }
      }
    }
    frontier = next;
  }
  return dist;
}

/**
 * Iterative-deepening A* over a state of `width` integers.
 *   moves     move indices allowed; axisOf / orderOf give each move's axis and
 *             a rank so that commuting moves on one axis are tried in one order
 *   apply     (src, dst, move) writes the successor into dst
 *   h         admissible estimate (0 at the goal)
 *   goal      (state, path) final check once h is 0
 * Returns the move path or null.
 */
export function ida({ start, moves, axisOf, orderOf, apply, h, goal = () => true, maxDepth = 30 }) {
  const width = start.length;
  const buf = Array.from({ length: maxDepth + 1 }, () => new Int32Array(width));
  buf[0].set(start);
  const axis = moves.map(axisOf), order = moves.map(orderOf);
  const path = new Int32Array(maxDepth);
  let found = null;
  const search = (depth, bound, lastAxis, lastOrder) => {
    const st = buf[depth];
    const est = h(st);
    if (depth + est > bound) return false;
    if (est === 0 && goal(st, path.subarray(0, depth))) { found = Array.from(path.subarray(0, depth)); return true; }
    if (depth === maxDepth) return false;
    const next = buf[depth + 1];
    for (let k = 0; k < moves.length; k++) {
      if (axis[k] === lastAxis && order[k] <= lastOrder) continue;
      apply(st, next, moves[k]);
      path[depth] = moves[k];
      if (search(depth + 1, bound, axis[k], order[k])) return true;
    }
    return false;
  };
  for (let bound = h(buf[0]); bound <= maxDepth; bound++) {
    if (search(0, bound, -1, -1)) return found;
  }
  return null;
}
