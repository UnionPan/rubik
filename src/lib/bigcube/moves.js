/**
 * Big-cube moves as sticker permutations, for the reduction solver.
 *
 * Sticker index: f·N² + r·N + c (cubeState's face order U R F D L B).
 * A move is { face, layer, amount } with amount 1 (clockwise), 2 or 3
 * (counter-clockwise); its permutation `src` says where each sticker comes
 * from: after the move, sticker i shows what sticker src[i] showed.
 */
import { applyMove, FACE_NAMES, turnToNotation } from '../cubeState';

const cache = new Map();

function quarterPerm(N, face, layer) {
  const idx = Array.from({ length: 6 }, (_, f) =>
    Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => f * N * N + r * N + c)));
  return Int16Array.from(applyMove(idx, face, layer, true).flat(2));
}

/** src of "a then b" */
export function compose(a, b) {
  const out = new Int16Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[b[i]];
  return out;
}

export function invert(p) {
  const out = new Int16Array(p.length);
  for (let i = 0; i < p.length; i++) out[p[i]] = i;
  return out;
}

export function identity(n) {
  return Int16Array.from({ length: n }, (_, i) => i);
}

/** Apply a permutation to a sticker array (colors) */
export function permute(state, p) {
  const out = new Int8Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = state[p[i]];
  return out;
}

/**
 * Every single-layer move of an N×N cube: 6 faces × layers 0 … ⌊N/2⌋−1 ×
 * amounts 1, 2, 3, and on odd cubes the middle slices (from U, R and F only,
 * flagged `middle`: they move the fixed centers, so most stages leave them out).
 * Returns { N, moves: [{ face, layer, amount, perm, axis, middle }], byKey }.
 */
export function bigCubeMoves(N) {
  if (cache.has(N)) return cache.get(N);
  const moves = [];
  for (const face of FACE_NAMES) {
    const layers = Math.floor(N / 2) + (N % 2 && 'URF'.includes(face) ? 1 : 0);
    for (let layer = 0; layer < layers; layer++) {
      const q = quarterPerm(N, face, layer);
      let p = q;
      for (let amount = 1; amount <= 3; amount++) {
        moves.push({ face, layer, amount, perm: p, axis: 'UDRLFB'.indexOf(face) >> 1, middle: N % 2 === 1 && layer === (N - 1) / 2 });
        p = compose(p, q);
      }
    }
  }
  const byKey = new Map(moves.map((m, i) => [`${m.face}${m.layer}${m.amount}`, i]));
  const result = { N, moves, byKey };
  cache.set(N, result);
  return result;
}

/** Flat sticker colors from a cubeState state */
export function flatten(state) {
  return Int8Array.from(state.flat(2));
}

/** Moves (indices into bigCubeMoves(N).moves) → quarter turns for the app */
export function toTurns(N, seq) {
  const { moves } = bigCubeMoves(N);
  const turns = [];
  for (const i of seq) {
    const { face, layer, amount } = moves[i];
    const cw = amount !== 3;
    const turn = { face, layers: [layer], cw };
    turn.notation = turnToNotation(turn, N);
    for (let k = 0; k < (amount === 2 ? 2 : 1); k++) turns.push({ ...turn });
  }
  return turns;
}

/**
 * Merge neighbouring moves of the same layer (R R → R2, R R' → nothing),
 * also across moves on the same axis, which commute.  Repeats until stable.
 */
export function simplify(N, seq) {
  const { moves, byKey } = bigCubeMoves(N);
  let out = [...seq];
  let changed = true;
  while (changed) {
    changed = false;
    const next = [];
    for (const i of out) {
      const m = moves[i];
      // Look back over moves on the same axis for the same face and layer
      let j = next.length - 1;
      while (j >= 0 && moves[next[j]].axis === m.axis
        && !(moves[next[j]].face === m.face && moves[next[j]].layer === m.layer)) j--;
      if (j >= 0 && moves[next[j]].axis === m.axis) {
        const prev = moves[next[j]];
        const amount = (prev.amount + m.amount) % 4;
        if (amount === 0) next.splice(j, 1);
        else next[j] = byKey.get(`${m.face}${m.layer}${amount}`);
        changed = true;
      } else {
        next.push(i);
      }
    }
    out = next;
  }
  return out;
}
