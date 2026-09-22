/**
 * twophase.js - Kociemba's two-phase algorithm: solve a 3×3 from its state.
 *
 *   G  = <U, D, R, L, F, B>                       all positions
 *   H  = <U, D, R2, L2, F2, B2>                   the subgroup of phase 2
 *
 * Phase 1 brings the cube into H: every corner twisted correctly, every edge
 * flipped correctly, and the four E-slice edges inside the E slice.  Phase 2
 * solves it using only moves of H.  Both phases are IDA* searches over small
 * "coordinates" of the cube, guided by exact distance tables (pruning tables)
 * computed by breadth-first search.
 *
 * The cubie-level moves are derived from cubeState's facelet engine, so the
 * solver and the rest of the site can never disagree about what a move does.
 */
import { applyMove, solvedState, FACE_NAMES } from './cubeState';

// ── Cubie model ──────────────────────────────────────────────────────────────
//
// Facelet index = face*9 + row*3 + col in cubeState's face order U R F D L B;
// this coincides with Kociemba's U1…B9 numbering.  Each corner lists its
// U/D facelet first, then the others clockwise.
const CORNER_FACELETS = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],   // URF UFL ULB UBR
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51], // DFR DLF DBL DRB
];
const EDGE_FACELETS = [
  [5, 10], [7, 19], [3, 37], [1, 46],     // UR UF UL UB
  [32, 16], [28, 25], [30, 43], [34, 52], // DR DF DL DB
  [23, 12], [21, 41], [50, 39], [48, 14], // FR FL BL BR  (the E slice)
];
const faceOf = (facelet) => Math.floor(facelet / 9);
const CORNER_COLORS = CORNER_FACELETS.map(fs => fs.map(faceOf));
const EDGE_COLORS = EDGE_FACELETS.map(fs => fs.map(faceOf));
const U = 0, D = 3;

export class IllegalCubeError extends Error {}

/**
 * Facelets (54 face labels 0-5, each center labelled with its own face) →
 * cubie cube { cp, co, ep, eo } in "replaced-by" form: position i holds
 * cubie cp[i] with twist co[i].
 */
export function faceletsToCubie(f) {
  const cp = new Int8Array(8), co = new Int8Array(8);
  const ep = new Int8Array(12), eo = new Int8Array(12);
  for (let i = 0; i < 8; i++) {
    const fs = CORNER_FACELETS[i];
    let ori = 0;
    while (ori < 3 && f[fs[ori]] !== U && f[fs[ori]] !== D) ori++;
    if (ori === 3) throw new IllegalCubeError('A corner has no top or bottom color');
    const c1 = f[fs[(ori + 1) % 3]], c2 = f[fs[(ori + 2) % 3]];
    const j = CORNER_COLORS.findIndex(cc => cc[1] === c1 && cc[2] === c2);
    if (j < 0) throw new IllegalCubeError('A corner has an impossible color combination');
    cp[i] = j;
    co[i] = ori;
  }
  for (let i = 0; i < 12; i++) {
    const [a, b] = EDGE_FACELETS[i].map(x => f[x]);
    const j = EDGE_COLORS.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
    if (j < 0) throw new IllegalCubeError('An edge has an impossible color combination');
    ep[i] = j;
    eo[i] = EDGE_COLORS[j][0] === a ? 0 : 1;
  }
  return { cp, co, ep, eo };
}

/** a · b : first a, then b */
function multiply(a, b) {
  const cp = new Int8Array(8), co = new Int8Array(8);
  const ep = new Int8Array(12), eo = new Int8Array(12);
  for (let i = 0; i < 8; i++) {
    cp[i] = a.cp[b.cp[i]];
    co[i] = (a.co[b.cp[i]] + b.co[i]) % 3;
  }
  for (let i = 0; i < 12; i++) {
    ep[i] = a.ep[b.ep[i]];
    eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2;
  }
  return { cp, co, ep, eo };
}

const flatten = (st) => st.flat(2);
const SOLVED = faceletsToCubie(flatten(solvedState(3)));

// Move m = face*3 + (power-1), faces in order U R F D L B; power 1, 2, 3 = X, X2, X'
const MOVE_CUBIE = [];
for (let face = 0; face < 6; face++) {
  const basic = faceletsToCubie(flatten(applyMove(solvedState(3), FACE_NAMES[face], 0, true)));
  let c = SOLVED;
  for (let p = 1; p <= 3; p++) {
    c = multiply(c, basic);
    MOVE_CUBIE.push(c);
  }
}
const N_MOVES = 18;
const ALL_MOVES = Array.from({ length: N_MOVES }, (_, m) => m);
// H = <U, D, R2, L2, F2, B2>
const PHASE2_MOVES = [0, 1, 2, 9, 10, 11, 4, 13, 7, 16];
const IS_PHASE2_MOVE = new Uint8Array(N_MOVES);
PHASE2_MOVES.forEach(m => { IS_PHASE2_MOVE[m] = 1; });

export function moveNotation(m) {
  return FACE_NAMES[Math.floor(m / 3)] + ['', '2', "'"][m % 3];
}

// ── Coordinates ──────────────────────────────────────────────────────────────

function permRank(arr, offset, k) {
  let r = 0;
  for (let i = 0; i < k; i++) {
    let smaller = 0;
    for (let j = i + 1; j < k; j++) if (arr[offset + j] < arr[offset + i]) smaller++;
    r = r * (k - i) + smaller;
  }
  return r;
}

const binom = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
};

const twist = (c) => { let t = 0; for (let i = 0; i < 7; i++) t = t * 3 + c.co[i]; return t; };
const flip = (c) => { let t = 0; for (let i = 0; i < 11; i++) t = t * 2 + c.eo[i]; return t; };
/** Which 4 of the 12 positions hold E-slice edges (order ignored): 0 … 494 */
const slice = (c) => {
  let a = 0, x = 0;
  for (let j = 11; j >= 0; j--) if (c.ep[j] >= 8) { a += binom(11 - j, x + 1); x++; }
  return a;
};
const cornerPerm = (c) => permRank(c.cp, 0, 8);
const udEdgePerm = (c) => permRank(c.ep, 0, 8);    // valid inside H
const slicePerm = (c) => {
  const s = [c.ep[8] - 8, c.ep[9] - 8, c.ep[10] - 8, c.ep[11] - 8];
  return permRank(s, 0, 4);
};

// ── Tables (built once, lazily) ──────────────────────────────────────────────

/**
 * Move table for a coordinate: next = table[coord * 18 + move].  Built by
 * breadth-first search over representative cubies, so no inverse coordinate
 * functions are needed.
 */
function buildMoveTable(size, coordFn, moves) {
  const table = new Int32Array(size * N_MOVES).fill(-1);
  const reps = new Array(size);
  reps[coordFn(SOLVED)] = SOLVED;
  const queue = [SOLVED];
  for (let q = 0; q < queue.length; q++) {
    const cube = queue[q];
    const v = coordFn(cube);
    for (const m of moves) {
      const next = multiply(cube, MOVE_CUBIE[m]);
      const nv = coordFn(next);
      table[v * N_MOVES + m] = nv;
      if (!reps[nv]) { reps[nv] = next; queue.push(next); }
    }
  }
  if (queue.length !== size) throw new Error(`coordinate reached ${queue.length} of ${size} values`);
  return table;
}

/** Distance table over a pair of coordinates (a × b), by breadth-first search */
function buildPruning(tableA, sizeA, tableB, sizeB, moves) {
  const total = sizeA * sizeB;
  const dist = new Int8Array(total).fill(-1);
  const queue = new Int32Array(total);
  let head = 0, tail = 0;
  dist[0] = 0;
  queue[tail++] = 0;
  while (head < tail) {
    const idx = queue[head++];
    const a = Math.floor(idx / sizeB), b = idx % sizeB;
    const d = dist[idx] + 1;
    for (const m of moves) {
      const n = tableA[a * N_MOVES + m] * sizeB + tableB[b * N_MOVES + m];
      if (dist[n] < 0) { dist[n] = d; queue[tail++] = n; }
    }
  }
  return dist;
}

let TABLES = null;

/** Build all move and pruning tables (≈0.5 s); later calls are free */
export function initTables() {
  if (TABLES) return TABLES;
  const twistMove = buildMoveTable(2187, twist, ALL_MOVES);
  const flipMove = buildMoveTable(2048, flip, ALL_MOVES);
  const sliceMove = buildMoveTable(495, slice, ALL_MOVES);
  const cpermMove = buildMoveTable(40320, cornerPerm, PHASE2_MOVES);
  const udMove = buildMoveTable(40320, udEdgePerm, PHASE2_MOVES);
  const spMove = buildMoveTable(24, slicePerm, PHASE2_MOVES);
  TABLES = {
    twistMove, flipMove, sliceMove, cpermMove, udMove, spMove,
    twistSlicePrune: buildPruning(twistMove, 2187, sliceMove, 495, ALL_MOVES),
    flipSlicePrune: buildPruning(flipMove, 2048, sliceMove, 495, ALL_MOVES),
    cpermSpPrune: buildPruning(cpermMove, 40320, spMove, 24, PHASE2_MOVES),
    udSpPrune: buildPruning(udMove, 40320, spMove, 24, PHASE2_MOVES),
  };
  return TABLES;
}

// ── Legality ─────────────────────────────────────────────────────────────────

function parity(perm) {
  let p = 0;
  for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) if (perm[j] < perm[i]) p ^= 1;
  return p;
}

function checkLegal(c) {
  if (new Set(c.cp).size !== 8) throw new IllegalCubeError('Some corner appears twice');
  if (new Set(c.ep).size !== 12) throw new IllegalCubeError('Some edge appears twice');
  if (c.co.reduce((s, x) => s + x, 0) % 3) throw new IllegalCubeError('A corner is twisted in place');
  if (c.eo.reduce((s, x) => s + x, 0) % 2) throw new IllegalCubeError('An edge is flipped in place');
  if (parity(c.cp) !== parity(c.ep)) throw new IllegalCubeError('Two pieces are swapped (corner and edge parity differ)');
}

// ── Search ───────────────────────────────────────────────────────────────────

/**
 * Solve a 3×3 given as 54 face labels (see faceletsToCubie).
 * Returns { moves: string[], phase1Length }.  After the first solution is
 * found, keeps looking for shorter ones for up to `improveMs` milliseconds.
 */
export function solveFacelets(facelets, { maxLength = 30, improveMs = 150 } = {}) {
  const T = initTables();
  const cube = faceletsToCubie(facelets);
  checkLegal(cube);

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let best = null;      // array of move ids
  let bestPhase1 = 0;
  let deadline = Infinity;
  const path1 = [];
  const path2 = [];

  const h1 = (tw, fl, sl) => Math.max(T.twistSlicePrune[tw * 495 + sl], T.flipSlicePrune[fl * 495 + sl]);
  const h2 = (cp, ud, sp) => Math.max(T.cpermSpPrune[cp * 24 + sp], T.udSpPrune[ud * 24 + sp]);

  const search2 = (cp, ud, sp, remaining, lastFace) => {
    if (h2(cp, ud, sp) > remaining) return false;
    if (remaining === 0) return true;
    for (const m of PHASE2_MOVES) {
      const face = Math.floor(m / 3);
      if (face === lastFace || (lastFace >= 0 && face % 3 === lastFace % 3 && face < lastFace)) continue;
      path2.push(m);
      if (search2(T.cpermMove[cp * N_MOVES + m], T.udMove[ud * N_MOVES + m], T.spMove[sp * N_MOVES + m], remaining - 1, face)) return true;
      path2.pop();
    }
    return false;
  };

  const tryPhase2 = () => {
    let c = cube;
    for (const m of path1) c = multiply(c, MOVE_CUBIE[m]);
    const cp = cornerPerm(c), ud = udEdgePerm(c), sp = slicePerm(c);
    const limit = (best ? best.length - 1 : maxLength) - path1.length;
    const lastFace = path1.length ? Math.floor(path1[path1.length - 1] / 3) : -1;
    for (let len2 = h2(cp, ud, sp); len2 <= limit; len2++) {
      path2.length = 0;
      if (search2(cp, ud, sp, len2, lastFace)) {
        best = [...path1, ...path2];
        bestPhase1 = path1.length;
        if (deadline === Infinity) deadline = now() + improveMs;
        return;
      }
    }
  };

  const search1 = (tw, fl, sl, remaining, lastFace) => {
    if (h1(tw, fl, sl) > remaining) return;
    if (remaining === 0) {
      // A phase-1 solution ending in a phase-2 move has a shorter twin: skip it
      if (path1.length && IS_PHASE2_MOVE[path1[path1.length - 1]]) return;
      tryPhase2();
      return;
    }
    for (let m = 0; m < N_MOVES; m++) {
      const face = Math.floor(m / 3);
      if (face === lastFace || (lastFace >= 0 && face % 3 === lastFace % 3 && face < lastFace)) continue;
      path1.push(m);
      search1(T.twistMove[tw * N_MOVES + m], T.flipMove[fl * N_MOVES + m], T.sliceMove[sl * N_MOVES + m], remaining - 1, face);
      path1.pop();
      if (now() > deadline) return;
    }
  };

  const tw0 = twist(cube), fl0 = flip(cube), sl0 = slice(cube);
  for (let len1 = h1(tw0, fl0, sl0); len1 <= 20; len1++) {
    if (best && (len1 >= best.length || now() > deadline)) break;
    search1(tw0, fl0, sl0, len1, -1);
  }
  if (!best) throw new Error('No solution found');
  return { moves: best.map(moveNotation), phase1Length: bestPhase1 };
}
