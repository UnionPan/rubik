/**
 * Centers of a 4×4, and the x-centers of a 5×5 (the four diagonal ones on
 * each face), solved in three stages with exact distance tables:
 *
 *   A  the two colors of the U/D axis onto the U and D faces
 *   B  keeping that, the two colors of the L/R axis onto L and R
 *      (only into arrangements stage C can finish)
 *   C  keeping both, every color onto its own face, using outer quarter
 *      turns and half turns of inner layers
 *
 * The orbit has 24 slots, so a set of slots is a 24-bit mask, and each
 * stage's table holds the exact distance of every reachable coordinate.  The
 * 5×5's +-centers are solved afterwards by 3-cycles (centerCycles.js).
 */
import { bigCubeMoves } from './moves';
import { RANK8, applyMask as apply, bfs, compress, maskTable, rankMask, BINOM } from './util';

const FACE_U = 0, FACE_R = 1, FACE_F = 2, FACE_D = 3, FACE_L = 4, FACE_B = 5;

// ── Orbits ─────────────────────────────────────────────────────────────────
function centerOrbits(N, moves) {
  const NN = N * N;
  const isCenter = (i) => {
    const r = Math.floor((i % NN) / N), c = i % N;
    return r > 0 && c > 0 && r < N - 1 && c < N - 1 && !(N % 2 && r === (N - 1) / 2 && c === (N - 1) / 2);
  };
  const parent = new Int16Array(6 * NN).map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const m of moves) for (let i = 0; i < 6 * NN; i++) if (isCenter(i)) parent[find(i)] = find(m.perm[i]);
  const groups = new Map();
  for (let i = 0; i < 6 * NN; i++) if (isCenter(i)) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }
  return [...groups.values()].map(stickers => {
    const slotOf = new Map(stickers.map((s, k) => [s, k]));
    const faceOf = stickers.map(s => Math.floor(s / NN));
    const faceMask = (...faces) => faceOf.reduce((m, f, k) => (faces.includes(f) ? m | (1 << k) : m), 0);
    // Per move: 3 byte tables mapping old mask bits to new mask bits
    const tables = moves.map(m => {
      // new slot k shows old slot src(k), so old slot src(k) moves to k
      const fwd = new Int8Array(24);
      for (let k = 0; k < 24; k++) fwd[slotOf.get(m.perm[stickers[k]])] = k;
      return maskTable(fwd);
    });
    const sideSlots = (a, b) => faceOf.map((f, k) => (f === a || f === b ? k : -1)).filter(k => k >= 0);
    return {
      stickers, faceOf, tables,
      udMask: faceMask(FACE_U, FACE_D), lrMask: faceMask(FACE_L, FACE_R), fbMask: faceMask(FACE_F, FACE_B),
      faceMasks: [0, 1, 2, 3, 4, 5].map(f => faceMask(f)),
      udSlots: sideSlots(FACE_U, FACE_D), lrSlots: sideSlots(FACE_L, FACE_R), fbSlots: sideSlots(FACE_F, FACE_B),
    };
  });
}

const cache = new Map();

/** Everything the center stages need for an N×N cube (built once, ~1 s) */
export function centerSolver(N) {
  if (cache.has(N)) return cache.get(N);
  const { moves } = bigCubeMoves(N);
  const all = centerOrbits(N, moves);
  const xSticker = N + 1; // U face, row 1, column 1
  const orbits = all.filter(o => o.stickers.includes(xSticker));
  const others = all.filter(o => !o.stickers.includes(xSticker)).map(o => o.stickers);

  const isOuter = (m) => m.layer === 0;
  const AXIS_UD = 0;
  // The middle slices of an odd cube would move the fixed centers
  const pick = (ok) => moves.map((m, i) => (!m.middle && ok(m) ? i : -1)).filter(i => i >= 0);
  const movesA = pick(() => true);
  const movesB = pick(m => isOuter(m) || m.axis === AXIS_UD || m.amount === 2);
  const movesC = pick(m => isOuter(m) || m.amount === 2);

  // One table per stage; every orbit has the same shape, so build per orbit
  for (const o of orbits) {
    o.tableA = bfs(BINOM[24][8], [o.udMask], rankMask,
      (mask) => movesA.map(i => apply(o.tables[i], mask)));
    o.tableB = bfs(BINOM[24][8], [o.lrMask], rankMask,
      (mask) => movesB.map(i => apply(o.tables[i], mask)));
    // Stage C coordinate: U color within the U/D slots, R within L/R, F within F/B
    const keyC = ([u, r, f]) => RANK8[compress(u, o.udSlots)] * 4900 + RANK8[compress(r, o.lrSlots)] * 70 + RANK8[compress(f, o.fbSlots)];
    o.keyC = keyC;
    o.tableC = bfs(70 * 70 * 70, [[o.faceMasks[FACE_U], o.faceMasks[FACE_R], o.faceMasks[FACE_F]]], keyC,
      (st) => movesC.map(i => st.map(mk => apply(o.tables[i], mk))));
  }
  const result = { N, orbits, others, movesA, movesB, movesC };
  cache.set(N, result);
  return result;
}

// ── Search ─────────────────────────────────────────────────────────────────

/** Per orbit, a 24-bit mask of the slots holding each color */
export function colorMasks(solver, flat) {
  return solver.orbits.map(o => {
    const masks = new Int32Array(6);
    o.stickers.forEach((s, k) => { masks[flat[s]] |= 1 << k; });
    return masks;
  });
}

/**
 * IDA* over a small integer state.  A stage tracks `width` masks per orbit
 * (stage.colors picks which colors); states live in preallocated buffers, so
 * the search allocates nothing per node.
 */
function idaStage(solver, masks, colors, allowed, h, isGoal, maxDepth = 30) {
  const { moves } = bigCubeMoves(solver.N);
  const { orbits } = solver;
  const width = colors.length;
  const size = orbits.length * width;
  const buf = Array.from({ length: maxDepth + 1 }, () => new Int32Array(size));
  orbits.forEach((_, oi) => colors.forEach((c, j) => { buf[0][oi * width + j] = masks[oi][c]; }));
  const tableOf = (oi, mi) => orbits[oi].tables[mi];
  const axis = allowed.map(mi => moves[mi].axis);
  // canonical order of commuting moves on one axis: by (face, layer)
  const order = allowed.map(mi => 'URFDLB'.indexOf(moves[mi].face) * 8 + moves[mi].layer);
  const path = new Int32Array(maxDepth);
  let found = null;

  const search = (depth, bound, lastAxis, lastOrder) => {
    const st = buf[depth];
    const est = h(st);
    if (depth + est > bound) return false;
    if (est === 0 && isGoal(st)) { found = Array.from(path.subarray(0, depth)); return true; }
    if (depth === maxDepth) return false;
    const next = buf[depth + 1];
    for (let k = 0; k < allowed.length; k++) {
      if (axis[k] === lastAxis && order[k] <= lastOrder) continue;
      const mi = allowed[k];
      for (let oi = 0; oi < orbits.length; oi++) {
        const t = tableOf(oi, mi);
        for (let j = 0; j < width; j++) {
          const m = st[oi * width + j];
          next[oi * width + j] = t[m & 255] | t[256 + ((m >> 8) & 255)] | t[512 + ((m >> 16) & 255)];
        }
      }
      path[depth] = mi;
      if (search(depth + 1, bound, axis[k], order[k])) return true;
    }
    return false;
  };
  for (let bound = h(buf[0]); bound <= maxDepth; bound++) {
    if (search(0, bound, -1, -1)) return found;
  }
  return null;
}

/**
 * Solve the centers of `flat` (Int8Array of sticker colors).
 * colorOf: the color that belongs on each face (U R F D L B).
 * Returns { stages: [{ id, moves }] } with move indices, or null.
 */
export function solveCenters(solver, flat, colorOf) {
  const { orbits } = solver;
  const cU = colorOf[FACE_U], cD = colorOf[FACE_D], cL = colorOf[FACE_L], cR = colorOf[FACE_R], cF = colorOf[FACE_F];
  const n = orbits.length;
  let masks = colorMasks(solver, flat);

  // A: tracks U and D masks
  const hA = (st) => {
    let h = 0;
    for (let oi = 0; oi < n; oi++) h = Math.max(h, orbits[oi].tableA[rankMask(st[2 * oi] | st[2 * oi + 1])]);
    return h;
  };
  // B: tracks L, R, U, F masks; the goal must be finishable by stage C
  const keyC = (oi, u, r, f) => orbits[oi].keyC([u, r, f]);
  const hB = (st) => {
    let h = 0;
    for (let oi = 0; oi < n; oi++) h = Math.max(h, orbits[oi].tableB[rankMask(st[4 * oi] | st[4 * oi + 1])]);
    return h;
  };
  const finishable = (st) => {
    for (let oi = 0; oi < n; oi++) {
      if (orbits[oi].tableC[keyC(oi, st[4 * oi + 2], st[4 * oi + 1], st[4 * oi + 3])] === 255) return false;
    }
    return true;
  };
  // C: tracks U, R, F masks
  const hC = (st) => {
    let h = 0;
    for (let oi = 0; oi < n; oi++) h = Math.max(h, orbits[oi].tableC[keyC(oi, st[3 * oi], st[3 * oi + 1], st[3 * oi + 2])]);
    return h;
  };

  const stages = [];
  const run = (id, colors, allowed, h, goal) => {
    const seq = idaStage(solver, masks, colors, allowed, h, goal);
    if (!seq) return false;
    for (const mi of seq) {
      masks = masks.map((m, oi) => m.map(mk => apply(orbits[oi].tables[mi], mk)));
    }
    stages.push({ id, moves: seq });
    return true;
  };
  if (!run('centers-ud', [cU, cD], solver.movesA, hA, () => true)) return null;
  if (!run('centers-lr', [cL, cR, cU, cF], solver.movesB, hB, finishable)) return null;
  if (!run('centers-all', [cU, cR, cF], solver.movesC, hC, () => true)) return null;
  return { stages };
}
