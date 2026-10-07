/**
 * The 5×5's +-centers, solved by 3-cycles once the x-centers are done.
 *
 * As with the wings (edges.js), the library is generated: commutators
 * [A, B] of an inner-slice quarter turn A and a short B (one move, or X Y X⁻¹)
 * are kept when they cycle exactly three +-centers, keep every x-center on
 * its face and leave the fixed centers alone.  Edges and corners are free to
 * move: they are solved later.  Conjugating by outer moves (which keep every
 * center on its face) reaches more triples.
 *
 * +-centers of one color are interchangeable, so the solver is greedy: it
 * always applies the cycle that puts the most +-centers onto their faces.
 */
import { bigCubeMoves, compose, invert, identity } from './moves';

const cache = new Map();

export function plusCenterSolver(N, slotsStickers) {
  if (cache.has(N)) return cache.get(N);
  const NN = N * N;
  const { moves } = bigCubeMoves(N);
  const size = 6 * NN;
  const faceOf = (s) => Math.floor(s / NN);
  const M = N - 1;
  const isX = (s) => {
    const r = Math.floor((s % NN) / N), c = s % N;
    return r > 0 && c > 0 && r < M && c < M && r !== M / 2 && c !== M / 2;
  };
  const xStickers = Array.from({ length: size }, (_, s) => s).filter(isX);
  const slots = slotsStickers;
  const slotOf = new Map(slots.map((s, k) => [s, k]));

  const pureCycle = (perm) => {
    for (const s of xStickers) if (faceOf(perm[s]) !== faceOf(s)) return null;
    const moved = [];
    for (let k = 0; k < slots.length; k++) if (perm[slots[k]] !== slots[k]) moved.push(k);
    if (moved.length !== 3) return null;
    const from = (k) => slotOf.get(perm[slots[k]]);
    // piece at p goes to q when from(q) = p
    const p = moved[0];
    const q = moved.find(k => from(k) === p);
    const r = moved.find(k => from(k) === q);
    return q != null && r != null && from(p) === r ? [p, q, r] : null;
  };
  const canonical = ([p, q, r]) => [[p, q, r], [q, r, p], [r, p, q]].reduce((b, c) => (c[0] < b[0] ? c : b));
  const inverseMove = (mi) => moves.findIndex(m => m.face === moves[mi].face && m.layer === moves[mi].layer && m.amount === 4 - moves[mi].amount);
  const seqPerm = (seq) => seq.reduce((p, mi) => compose(p, moves[mi].perm), identity(size));

  const outer = moves.map((m, i) => (m.layer === 0 ? i : -1)).filter(i => i >= 0);
  const inner = moves.map((m, i) => (m.layer === 1 && m.amount !== 2 ? i : -1)).filter(i => i >= 0);
  const allMoves = moves.map((_, i) => i);
  const Bs = [
    ...allMoves.map(mi => [mi]),
    ...outer.flatMap(x => allMoves.filter(y => moves[y].face !== moves[x].face).map(y => [x, y, inverseMove(x)])),
  ];

  const base = new Map();
  for (const B of Bs) {
    const Bp = seqPerm(B), Bi = invert(Bp);
    for (const a of inner) {
      const A = moves[a].perm;
      const cyc = pureCycle(compose(compose(compose(A, Bp), invert(A)), Bi));
      if (!cyc) continue;
      const algo = [a, ...B, inverseMove(a), ...B.slice().reverse().map(inverseMove)];
      const key = canonical(cyc).join();
      if (!base.has(key) || base.get(key).moves.length > algo.length) base.set(key, { cycle: canonical(cyc), moves: algo });
    }
  }

  // Outer setups up to two moves
  const setups = [[]];
  for (const x of outer) {
    setups.push([x]);
    for (const y of outer) if (moves[y].face !== moves[x].face) setups.push([x, y]);
  }
  const library = new Map();
  for (const { cycle: [p, q, r], moves: c } of base.values()) {
    for (const S of setups) {
      const Sp = seqPerm(S);
      // S moves the piece at slot j to the slot whose source is j
      const back = (k) => slotOf.get(Sp[slots[k]]);
      const cyc = canonical([back(p), back(q), back(r)]);
      const key = cyc.join();
      const len = c.length + 2 * S.length;
      if (!library.has(key) || library.get(key).moves.length > len) {
        library.set(key, { cycle: cyc, moves: [...S, ...c, ...S.slice().reverse().map(inverseMove)] });
      }
    }
  }
  const result = { N, slots, library };
  cache.set(N, result);
  return result;
}

/** Two cycles that together put more +-centers home, when no single one does */
function lookahead(entries, col, want) {
  const correct = (c) => c.reduce((n, x, k) => n + (x === want[k]), 0);
  const base = correct(col);
  let best = null, bestGain = 0, bestLen = Infinity;
  for (const e1 of entries) {
    const c1 = [...col];
    const [p, q, r] = e1.cycle;
    [c1[p], c1[q], c1[r]] = [c1[r], c1[p], c1[q]];
    const g1 = correct(c1) - base;
    for (const e2 of entries) {
      const [a, b, c] = e2.cycle;
      const before = (c1[a] === want[a]) + (c1[b] === want[b]) + (c1[c] === want[c]);
      const after = (c1[c] === want[a]) + (c1[a] === want[b]) + (c1[b] === want[c]);
      const gain = g1 + after - before;
      const len = e1.moves.length + e2.moves.length;
      if (gain > bestGain || (gain === bestGain && gain > 0 && len < bestLen)) { best = [e1, e2]; bestGain = gain; bestLen = len; }
    }
  }
  return best;
}

/** Greedy 3-cycles until every +-center is on its face; returns move indices */
export function solvePlusCenters(ps, flat, colorOf) {
  const NN = ps.N * ps.N;
  const want = ps.slots.map(s => colorOf[Math.floor(s / NN)]);
  const col = ps.slots.map(s => flat[s]);
  const entries = [...ps.library.values()];
  const out = [];
  for (let guard = 0; guard < 60; guard++) {
    let wrong = 0;
    for (let k = 0; k < col.length; k++) if (col[k] !== want[k]) wrong++;
    if (!wrong) return out;
    let best = null, bestGain = 0;
    for (const e of entries) {
      const [p, q, r] = e.cycle;
      const before = (col[p] === want[p]) + (col[q] === want[q]) + (col[r] === want[r]);
      // piece at p → q, q → r, r → p
      const after = (col[r] === want[p]) + (col[p] === want[q]) + (col[q] === want[r]);
      const gain = after - before;
      if (gain > bestGain || (gain === bestGain && gain > 0 && e.moves.length < best.moves.length)) { best = e; bestGain = gain; }
    }
    const plan = best ? [best] : lookahead(entries, col, want);
    if (!plan) throw new Error('no +-center cycle makes progress');
    for (const e of plan) {
      const [p, q, r] = e.cycle;
      [col[p], col[q], col[r]] = [col[r], col[p], col[q]];
      out.push(...e.moves);
    }
  }
  throw new Error('+-centers did not finish');
}
