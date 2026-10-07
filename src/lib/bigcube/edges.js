/**
 * Edges of a 4×4 or 5×5 with solved centers, by 3-cycles of wings.
 *
 * A wing is one of the two (4×4) or two outer (5×5) pieces of an edge.  The
 * library of 3-cycles is generated, not typed in: every commutator
 * [A, B] = A B A⁻¹ B⁻¹ of an inner-slice quarter turn A and up to three outer
 * moves B is checked, and the ones that cycle exactly three wings while
 * keeping every center on its face, and every corner and middle edge in
 * place, are kept.  Conjugating by up to three outer moves (which never
 * carry a center off its face) reaches any three wings.
 *
 * Wings can never flip in place, so each wing slot is an ordered pair of
 * stickers with one consistent orientation, and a wing's two colors read in
 * slot order identify it.
 */
import { faceletCubie } from '../faceletGraph';
import { bigCubeMoves, compose, invert } from './moves';

const cache = new Map();

/** Stickers grouped into pieces by their cubie */
export function pieces(N) {
  const byCubie = new Map();
  for (let f = 0; f < 6; f++) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const key = faceletCubie(f, r, c, N).join(',');
    if (!byCubie.has(key)) byCubie.set(key, { cubie: faceletCubie(f, r, c, N), stickers: [] });
    byCubie.get(key).stickers.push(f * N * N + r * N + c);
  }
  return [...byCubie.values()];
}

export function edgeSolver(N) {
  if (cache.has(N)) return cache.get(N);
  const NN = N * N;
  const { moves } = bigCubeMoves(N);
  const all = pieces(N);
  const M = N - 1;
  const innerCoord = (cubie) => cubie.find(v => v !== 0 && v !== M);
  const corners = all.filter(p => p.stickers.length === 3).flatMap(p => p.stickers);
  const edgePieces = all.filter(p => p.stickers.length === 2);
  const midges = edgePieces.filter(p => N % 2 && innerCoord(p.cubie) === M / 2).flatMap(p => p.stickers);
  const wingPieces = edgePieces.filter(p => !(N % 2 && innerCoord(p.cubie) === M / 2));
  const faceOf = (s) => Math.floor(s / NN);
  const isCenter = (s) => {
    const r = Math.floor((s % NN) / N), c = s % N;
    return r > 0 && c > 0 && r < M && c < M;
  };
  const centers = Array.from({ length: 6 * NN }, (_, s) => s).filter(isCenter);

  // Wing slots, ordered consistently by following moves from one slot
  const dsts = moves.map(m => invert(m.perm)); // dst[s] = where sticker s goes
  const slots = [];
  const slotIndex = new Map();
  const first = wingPieces[0].stickers;
  const queue = [[first[0], first[1]]];
  slotIndex.set(`${first[0]},${first[1]}`, 0);
  slots.push(queue[0]);
  while (queue.length) {
    const [a, b] = queue.shift();
    for (const dst of dsts) {
      const key = `${dst[a]},${dst[b]}`;
      if (slotIndex.has(key)) continue;
      if (slotIndex.has(`${dst[b]},${dst[a]}`)) throw new Error('a wing flipped in place');
      slotIndex.set(key, slots.length);
      slots.push([dst[a], dst[b]]);
      queue.push([dst[a], dst[b]]);
    }
  }
  if (slots.length !== wingPieces.length) throw new Error(`found ${slots.length} wing slots`);

  /** Wing-slot permutation of a sticker permutation: piece from slot from[k] lands in slot k */
  const slotSources = (perm) => slots.map(([a, b]) => slotIndex.get(`${perm[a]},${perm[b]}`));

  /** The 3-cycle (p → q → r) a permutation makes on the wings, if it is pure */
  const pureCycle = (perm) => {
    for (const s of corners) if (perm[s] !== s) return null;
    for (const s of midges) if (perm[s] !== s) return null;
    for (const s of centers) if (faceOf(perm[s]) !== faceOf(s)) return null;
    const from = slotSources(perm);
    const moved = [];
    for (let k = 0; k < from.length; k++) if (from[k] !== k) moved.push(k);
    if (moved.length !== 3) return null;
    // from[q] = p means the piece at p goes to q
    const p = moved[0];
    const q = from.indexOf(p);
    const r = from.indexOf(q);
    return from[p] === r ? [p, q, r] : null;
  };

  // Outer-move sequences up to length 3 (no face twice in a row)
  const outer = moves.map((m, i) => (m.layer === 0 ? i : -1)).filter(i => i >= 0);
  const seqs = [[]];
  for (let len = 1; len <= 3; len++) {
    for (const s of seqs.filter(x => x.length === len - 1)) {
      for (const mi of outer) {
        if (s.length && moves[s[s.length - 1]].face === moves[mi].face) continue;
        seqs.push([...s, mi]);
      }
    }
  }
  const seqPerm = (seq) => seq.reduce((p, mi) => compose(p, moves[mi].perm), Uint16Array.from({ length: 6 * NN }, (_, i) => i));
  const inverseMove = (mi) => moves.findIndex(m => m.face === moves[mi].face && m.layer === moves[mi].layer && m.amount === 4 - moves[mi].amount);
  const inverseSeq = (seq) => seq.slice().reverse().map(inverseMove);
  const seqPerms = seqs.map(seqPerm);

  // Base library: commutators of an inner quarter turn and an outer sequence
  const inner = moves.map((m, i) => (m.layer === 1 && m.amount !== 2 ? i : -1)).filter(i => i >= 0);
  const base = new Map(); // canonical cycle key → { cycle, moves }
  const canonical = ([p, q, r]) => {
    const rots = [[p, q, r], [q, r, p], [r, p, q]];
    return rots.reduce((best, c) => (c[0] < best[0] ? c : best));
  };
  seqs.forEach((B, bi) => {
    if (!B.length) return;
    const Bp = seqPerms[bi], Bi = invert(Bp);
    for (const a of inner) {
      const A = moves[a].perm, Ai = invert(A);
      const comm = compose(compose(compose(A, Bp), Ai), Bi);
      const cyc = pureCycle(comm);
      if (!cyc) continue;
      const key = canonical(cyc).join();
      const algo = [a, ...B, inverseMove(a), ...inverseSeq(B)];
      if (!base.has(key) || base.get(key).moves.length > algo.length) base.set(key, { cycle: canonical(cyc), moves: algo });
    }
  });

  // Conjugate by outer setups: every 3-cycle with its shortest algorithm
  const setupSlots = seqPerms.map(p => {
    // piece at slot j goes to fwd[j]
    const from = slotSources(p);
    const fwd = new Int16Array(slots.length);
    from.forEach((src, k) => { fwd[src] = k; });
    return fwd;
  });
  const library = new Map(); // "p,q,r" (any rotation stored canonically) → moves
  for (const { cycle: [p, q, r], moves: c } of base.values()) {
    seqs.forEach((S, si) => {
      // S, then the cycle, then S⁻¹: in original slots the cycle is S⁻¹(p) → S⁻¹(q) → S⁻¹(r)
      const fwd = setupSlots[si];
      const back = (k) => fwd.indexOf(k);
      const cyc = canonical([back(p), back(q), back(r)]);
      const key = cyc.join();
      const len = c.length + 2 * S.length;
      if (!library.has(key) || library.get(key).length > len) library.set(key, [...S, ...c, ...inverseSeq(S)]);
    });
  }

  const result = {
    N, slots, slotIndex, library, base, midges, corners,
    /** canonical key of a directed 3-cycle */
    key: (cyc) => canonical(cyc).join(),
  };
  cache.set(N, result);
  return result;
}

/**
 * Where each wing has to go.  4×4: home, next to the centers of its colors
 * (colorOf[face] is the color on each face); with
 * swapUFUB the UF and UB edges trade places (fixes PLL parity for free).
 * 5×5: next to its middle edge, read from the midges' colors.
 * Returns target[slot] = slot the piece now at `slot` must reach.
 */
export function wingTargets(es, flat, { colorOf = [0, 1, 2, 3, 4, 5], swapUFUB = false } = {}) {
  const { N, slots, slotIndex } = es;
  const NN = N * N;
  const face = (s) => Math.floor(s / NN);
  let expected; // expected colors of each slot, read in slot order
  if (N % 2) {
    // The midge of a wing's edge: the edge piece with the same two faces
    const midgeOn = new Map();
    for (let i = 0; i < es.midges.length; i += 2) {
      const [a, b] = [es.midges[i], es.midges[i + 1]];
      midgeOn.set(`${face(a)},${face(b)}`, [flat[a], flat[b]]);
      midgeOn.set(`${face(b)},${face(a)}`, [flat[b], flat[a]]);
    }
    expected = slots.map(([a, b]) => midgeOn.get(`${face(a)},${face(b)}`));
  } else {
    expected = slots.map(([a, b]) => [colorOf[face(a)], colorOf[face(b)]]);
    if (swapUFUB) {
      // U2 carries the UF edge onto UB and back
      const { moves, byKey } = bigCubeMoves(N);
      const u2 = moves[byKey.get('U02')].perm;
      const U = 0, F = 2, B = 5;
      const isEdge = (k, f2) => { const [a, b] = slots[k]; const fs = [face(a), face(b)]; return fs.includes(U) && fs.includes(f2); };
      const swapped = expected.map(e => e);
      slots.forEach(([a, b], k) => {
        if (isEdge(k, F) || isEdge(k, B)) {
          // the slot U2 brings here
          const src = slotIndex.get(`${u2[a]},${u2[b]}`);
          swapped[k] = expected[src];
        }
      });
      expected = swapped;
    }
  }
  const homeOf = new Map(expected.map((e, k) => [e.join(), k]));
  return slots.map(([a, b]) => homeOf.get(`${flat[a]},${flat[b]}`));
}

/** Parity of a target permutation (1 = odd) */
export function targetParity(target) {
  const seen = new Uint8Array(target.length);
  let swaps = 0;
  for (let i = 0; i < target.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = target[j]) { seen[j] = 1; len++; }
    swaps += len - 1;
  }
  return swaps % 2;
}

/**
 * Move every wing to its target with 3-cycles through buffer slot 0.
 * Returns move indices, or null when the target permutation is odd.
 */
export function solveWings(es, target) {
  if (targetParity(target) === 1) return null;
  const t = [...target]; // t[slot] = target of the piece now in slot
  const out = [];
  const cycle = (p, q, r) => {
    // piece at p → q, at q → r, at r → p
    const algo = es.library.get(es.key([p, q, r]));
    if (algo) out.push(...algo);
    else {
      // (a→b→c) = (a→b→z) then (a→z→c), for a rotation of the cycle and a
      // slot z both exist for (the library lacks cycles holding both wings
      // of one edge, so this keeps such a pair apart)
      let split = null;
      for (const [a, b, c] of [[p, q, r], [q, r, p], [r, p, q]]) {
        const z = t.findIndex((_, k) => k !== p && k !== q && k !== r
          && es.library.has(es.key([a, b, k])) && es.library.has(es.key([a, k, c])));
        if (z >= 0) { split = [es.library.get(es.key([a, b, z])), es.library.get(es.key([a, z, c]))]; break; }
      }
      if (!split) throw new Error(`no algorithm for ${p}→${q}→${r}`);
      out.push(...split[0], ...split[1]);
    }
    const tp = t[p], tq = t[q], tr = t[r];
    t[q] = tp; t[r] = tq; t[p] = tr;
  };
  const buffer = 0;
  for (let guard = 0; guard < 200; guard++) {
    const unsolved = t.map((x, k) => (x !== k ? k : -1)).filter(k => k >= 0);
    if (!unsolved.length) return out;
    const x = t[buffer];
    if (x === buffer) {
      // Buffer piece is home: move it into an unsolved slot to start a new cycle
      const z = unsolved[0];
      const w = t[z] !== buffer ? t[z] : unsolved.find(k => k !== z && k !== buffer);
      cycle(buffer, z, w);
      continue;
    }
    const y = t[x];
    if (y !== buffer) { cycle(buffer, x, y); continue; }
    // x and the buffer swap: use any third unsolved piece
    const z = unsolved.find(k => k !== buffer && k !== x);
    cycle(buffer, x, z);
  }
  throw new Error('wing solve did not finish');
}
