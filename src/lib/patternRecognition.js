/**
 * patternRecognition.js
 *
 * Detects where a solve stands on any N×N cube and suggests the algorithm
 * from the library that applies next.
 *
 * Methods:
 *   2×2        layer by layer:  first layer → OLL → PLL
 *   3×3        CFOP:            cross → F2L → OLL → PLL (first layer on D)
 *   4×4, 5×5   reduction:       centers → edge pairing → the 3×3 stages on
 *                               the reduced cube, plus the parity cases
 *
 * Everything is read relative to the cube's own centers, so the detector
 * keeps working after whole-cube rotations (x, y, z) and slice moves.
 *
 * Reduction.  Group each face into a 3×3 grid of blocks: corners, the edge
 * strips between them, and the center block.  When every block is one color
 * (centers solved, edges paired) the big cube *is* a 3×3, and each 3×3
 * algorithm acts on it through the reduction map.
 *
 * Parity.  Every legal 3×3 state satisfies two invariants:
 *   (1) the edge flips sum to 0 mod 2,
 *   (2) the corner and edge permutations have the same parity.
 * A reduced 4×4 can break either one.  Breaking (1) is OLL parity, breaking
 * (2) is PLL parity - neither can be fixed by any 3×3 algorithm.
 *
 * Matching.  For OLL/PLL, candidate algorithms are simulated on the (reduced)
 * cube with every pre- and post-U-turn, which also tells the user which
 * setup turn to make.
 */

import {
  applyTurn, applyMoveSequence, isSolved, solvedState, parseMoveSequence, COLORS,
} from './cubeState';
import { ALGORITHMS, usesReducedNotation } from './algorithms';
import { faceletCubie } from './faceletGraph';

const U = 0, R = 1, F = 2, D = 3, L = 4, B = 5;
const SIDES = [F, R, B, L];
const AUF_NOTATION = ['', 'U', 'U2', "U'"];

const colorName = (c) => (c == null ? '?' : COLORS[c].name);

// ── 3×3 piece geometry (shared by the reduced cube) ──────────────────────────

/** Facelets of the 3×3 grouped by cubie: corners (3), edges (2) */
const PIECES_3 = (() => {
  const byCubie = new Map();
  for (let f = 0; f < 6; f++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const key = faceletCubie(f, r, c, 3).join(',');
        if (!byCubie.has(key)) byCubie.set(key, []);
        byCubie.get(key).push([f, r, c]);
      }
    }
  }
  const all = [...byCubie.values()];
  return {
    corners: all.filter(p => p.length === 3),
    edges: all.filter(p => p.length === 2),
  };
})();

/** An edge's reference facelet for orientation: on U/D if it has one, else on F/B */
function edgePrimary(edge) {
  return edge.find(([f]) => f === U || f === D) ?? edge.find(([f]) => f === F || f === B);
}

/**
 * The 24 legal center arrangements (the rotations of the solved cube),
 * as strings of the six center colors in face order U R F D L B.
 */
const LEGAL_CENTER_ARRANGEMENTS = (() => {
  const key = (st) => st.map(face => face[1][1]).join('');
  const seen = new Set();
  const queue = [solvedState(3)];
  while (queue.length) {
    const st = queue.shift();
    const k = key(st);
    if (seen.has(k)) continue;
    seen.add(k);
    for (const rot of ['x', 'y']) queue.push(applyMoveSequence(st, rot));
  }
  return seen;
})();

// ── Reduction to a 3×3 ───────────────────────────────────────────────────────

/** N×N indices covered by 3×3 row/column index i */
function blockRange(i, N) {
  if (i === 0) return [0];
  if (i === 2) return [N - 1];
  return Array.from({ length: N - 2 }, (_, k) => k + 1);
}

/**
 * Collapse each face into 3×3 blocks.  A block's value is its color if the
 * whole block is one color, otherwise null.  For N = 3 this is the state.
 */
export function reduceTo3x3(state) {
  const N = state[0].length;
  return state.map(face =>
    [0, 1, 2].map(r3 => [0, 1, 2].map(c3 => {
      const rows = blockRange(r3, N), cols = blockRange(c3, N);
      const first = face[rows[0]]?.[cols[0]];
      if (first === undefined) return null;
      for (const r of rows) for (const c of cols) if (face[r][c] !== first) return null;
      return first;
    })),
  );
}

// ── Invariants of the (reduced) 3×3 ──────────────────────────────────────────

function permutationParity(perm) {
  const seen = new Array(perm.length).fill(false);
  let transpositions = 0;
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = perm[j]) { seen[j] = true; len++; }
    transpositions += len - 1;
  }
  return transpositions % 2;
}

/**
 * Edge flip sum and permutation parities of a 3×3 state (colors relative to
 * its centers).  Returns null if the pieces cannot be identified.
 */
export function cubeInvariants(s3) {
  const center = s3.map(face => face[1][1]);
  const at = ([f, r, c]) => s3[f][r][c];
  const homeKey = (piece) => piece.map(([f]) => center[f]).sort().join(',');
  const pieceKey = (piece) => piece.map(at).sort().join(',');

  const identify = (pieces) => {
    const home = new Map(pieces.map((p, i) => [homeKey(p), i]));
    const perm = pieces.map(p => home.get(pieceKey(p)));
    return perm.some(v => v === undefined) || new Set(perm).size !== perm.length ? null : perm;
  };

  const cornerPerm = identify(PIECES_3.corners);
  const edgePerm = identify(PIECES_3.edges);
  if (!cornerPerm || !edgePerm) return null;

  // Edge orientation: is the piece's reference color on the slot's reference facelet?
  let flipSum = 0;
  PIECES_3.edges.forEach((slot, i) => {
    const home = PIECES_3.edges[edgePerm[i]];
    const refColor = center[edgePrimary(home)[0]];
    if (at(edgePrimary(slot)) !== refColor) flipSum++;
  });

  return {
    flipSum,
    cornerParity: permutationParity(cornerPerm),
    edgeParity: permutationParity(edgePerm),
  };
}

// ── 3×3 stage checks (relative to centers) ───────────────────────────────────

const centersOf = (s3) => s3.map(face => face[1][1]);

/** Cross on D: D edge facelets match D, their side facelets match that side */
function crossCount(s3) {
  const ctr = centersOf(s3);
  return PIECES_3.edges
    .filter(e => e.some(([f]) => f === D))
    .filter(e => e.every(([f, r, c]) => s3[f][r][c] === ctr[f]))
    .length;
}

/** F2L slots: the D corner + middle-layer edge between two adjacent sides */
function f2lSlotCount(s3) {
  const ctr = centersOf(s3);
  const ok = ([f, r, c]) => s3[f][r][c] === ctr[f];
  let done = 0;
  for (let i = 0; i < 4; i++) {
    const a = SIDES[i], b = SIDES[(i + 1) % 4];
    const corner = PIECES_3.corners.find(p => p.some(([f]) => f === D) && p.some(([f]) => f === a) && p.some(([f]) => f === b));
    const edge = PIECES_3.edges.find(p => p.some(([f]) => f === a) && p.some(([f]) => f === b));
    if (corner.every(ok) && edge.every(ok)) done++;
  }
  return done;
}

function isCrossDone(s3) { return crossCount(s3) === 4; }

function isF2LDone(s3) {
  const ctr = centersOf(s3);
  if (!s3[D].every(row => row.every(c => c === ctr[D]))) return false;
  return SIDES.every(f => [1, 2].every(r => s3[f][r].every(c => c === ctr[f])));
}

function isOLLDone(s3) {
  const u = s3[U][1][1];
  return s3[U].every(row => row.every(c => c === u));
}

/** Describe the OLL edge pattern for educational display */
function describeOLLEdges(s3) {
  const u = s3[U][1][1];
  const oriented = [s3[U][2][1], s3[U][1][2], s3[U][0][1], s3[U][1][0]].map(c => c === u); // F R B L
  const count = oriented.filter(Boolean).length;
  if (count === 0) return { pattern: 'dot', label: 'Dot — no edges oriented' };
  if (count === 4) return { pattern: 'cross', label: 'Cross — all 4 edges oriented' };
  if (count === 2) {
    const isLine = (oriented[0] && oriented[2]) || (oriented[1] && oriented[3]);
    return isLine
      ? { pattern: 'line', label: 'Line — 2 opposite edges oriented' }
      : { pattern: 'L', label: 'L-shape — 2 adjacent edges oriented' };
  }
  return { pattern: 'odd', label: `${count} of 4 edges oriented` };
}

// ── Algorithm matching by simulation ─────────────────────────────────────────

const aufTurns = (N, n) => parseMoveSequence(AUF_NOTATION[n] || '', N);
const applyAUF = (st, n) => aufTurns(st[0].length, n).reduce(applyTurn, st);

function candidates(category, N) {
  return ALGORITHMS.filter(a => a.category === category && a.cubeSize.includes(N));
}

/** Apply an algorithm as the Algorithms tab would on this cube */
function runAlg(st, alg) {
  return applyMoveSequence(st, alg.notation, { reduced: usesReducedNotation(alg) });
}

/**
 * First algorithm (with a pre-U-turn, and optionally a post-U-turn) whose
 * result passes `accept`.  Returns { alg, pre, post } or null.
 */
function findMatch(st, algs, accept, { post = false } = {}) {
  for (const alg of algs) {
    for (let pre = 0; pre < 4; pre++) {
      let result;
      try { result = runAlg(applyAUF(st, pre), alg); } catch { continue; }
      for (let p = 0; p < (post ? 4 : 1); p++) {
        if (accept(applyAUF(result, p))) return { alg, pre, post: p };
      }
    }
  }
  return null;
}

// ── Result helpers ───────────────────────────────────────────────────────────

function steps(ids, labels, currentId) {
  const idx = ids.indexOf(currentId);
  return ids.map((id, i) => ({
    id,
    label: labels[i],
    status: currentId === 'solved' || i < idx ? 'done' : i === idx ? 'current' : 'todo',
  }));
}

function result(fields) {
  return {
    matchedAlg: null, matchKind: null, setup: '', finish: '',
    edgeInfo: null, progress: null, notes: [], steps: [], method: '',
    ...fields,
  };
}

function withMatch(match, kind = 'exact') {
  if (!match) return {};
  return {
    matchedAlg: match.alg,
    matchKind: kind,
    setup: AUF_NOTATION[match.pre],
    finish: AUF_NOTATION[match.post ?? 0],
  };
}

// ── Main detection ───────────────────────────────────────────────────────────

/**
 * Detect the current solve stage and suggest the next algorithm.
 *
 * Returns {
 *   stage:      'solved'|'first-layer'|'centers'|'edges'|'cross'|'f2l'|'oll'|'oll-parity'|'pll'|'pll-parity',
 *   stageLabel: string,
 *   method:     string,             // e.g. 'Reduction'
 *   steps:      [{ id, label, status: 'done'|'current'|'todo' }],
 *   message:    string,             // what to do next
 *   progress:   { done, total, unit } | null,
 *   matchedAlg: object | null,      // library algorithm that applies
 *   matchKind:  'exact'|'suggested'|null,
 *   setup, finish: string,          // U turns to do before / after the algorithm
 *   edgeInfo:   OLL edge pattern | null,
 *   notes:      string[],           // invariant explanations and heads-ups
 * }
 */
export function detectPattern(state, N) {
  if (N === 2) return detect2x2(state);
  return detectBig(state, N);
}

// ── 2×2 ──────────────────────────────────────────────────────────────────────

const STEPS_2 = [['first-layer', 'oll', 'pll'], ['First layer', 'OLL', 'PLL']];

function detect2x2(state) {
  const base = { method: 'Layer by layer' };
  const mk = (stage, stageLabel, fields) =>
    result({ ...base, stage, stageLabel, steps: steps(...STEPS_2, stage), ...fields });

  if (isSolved(state)) {
    return mk('solved', 'Solved', { message: 'The cube is solved. Try a scramble or explore algorithms.' });
  }

  const dFace = state[D].flat();
  const firstLayer = (st) => {
    const d = st[D][0][0];
    return st[D].every(row => row.every(c => c === d)) &&
      SIDES.every(f => st[f][1][0] === st[f][1][1]);
  };

  if (!firstLayer(state)) {
    // Most common color on D is the one being built
    const counts = {};
    dFace.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
    const [dColor, have] = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    const faceDone = have === 4;
    return mk('first-layer', 'First layer', {
      message: faceDone
        ? 'The D face is one color; now make the bottom stickers on each side match in pairs.'
        : `Build the first layer: four ${colorName(+dColor)} stickers on D, with matching side pairs.`,
      progress: { done: have, total: 4, unit: `${colorName(+dColor)} on D` },
    });
  }

  const uniformU = (st) => st[U].every(row => row.every(c => c === st[U][0][0]));
  if (!uniformU(state)) {
    const match = findMatch(state, candidates('OLL', 2), st => firstLayer(st) && uniformU(st));
    return mk('oll', 'OLL', {
      message: match
        ? `Detected: ${match.alg.name} orients the top layer.`
        : 'Orient the top layer so all four top stickers match.',
      ...withMatch(match),
    });
  }

  const match = findMatch(state, candidates('PLL', 2), isSolved, { post: true });
  return mk('pll', 'PLL', {
    message: match
      ? `Detected: ${match.alg.name} permutes the last layer.`
      : 'Top and bottom are oriented. Permute the last-layer corners.',
    ...withMatch(match),
  });
}

// ── 3×3 and reduction (N ≥ 3) ────────────────────────────────────────────────

function detectBig(state, N) {
  const isReduction = N > 3;
  const ids = isReduction
    ? ['centers', 'edges', 'cross', 'f2l', 'oll', 'pll']
    : ['cross', 'f2l', 'oll', 'pll'];
  const labels = isReduction
    ? ['Centers', 'Edges', 'Cross', 'F2L', 'OLL', 'PLL']
    : ['Cross', 'F2L', 'OLL', 'PLL'];
  const method = isReduction ? 'Reduction' : 'CFOP';
  const mk = (stage, stageLabel, fields) => {
    const stepId = stage.replace('-parity', '');
    return result({ method, stage, stageLabel, steps: steps(ids, labels, stepId), ...fields });
  };

  if (isSolved(state)) {
    return mk('solved', 'Solved', { message: 'The cube is solved. Try a scramble or explore algorithms.' });
  }

  const s3 = reduceTo3x3(state);

  // ── Centers ──
  if (isReduction) {
    const solvedCenters = s3.filter(face => face[1][1] !== null).length;
    if (solvedCenters < 6) {
      return mk('centers', 'Centers', {
        message: `Build a solid ${N - 2}×${N - 2} center on each face. Inner slice turns (2R, 2U, …) move centers; outer turns only spin them in place.`,
        progress: { done: solvedCenters, total: 6, unit: 'centers' },
      });
    }
    const arrangement = s3.map(face => face[1][1]).join('');
    if (!LEGAL_CENTER_ARRANGEMENTS.has(arrangement)) {
      return mk('centers', 'Centers', {
        message: 'All six centers are solid but in the wrong arrangement: white/yellow, red/orange and green/blue must be opposite, in the standard order around the cube.',
        progress: { done: 5, total: 6, unit: 'centers' },
      });
    }
  }

  // ── Edge pairing ──
  if (isReduction) {
    const paired = PIECES_3.edges.filter(e => e.every(([f, r, c]) => s3[f][r][c] !== null)).length;
    if (paired < 12) {
      const lastEdge = N % 2 === 1 && paired === 11;
      const edgeFlip = ALGORITHMS.find(a => a.id === 'edge_flip');
      const pairing = ALGORITHMS.find(a => a.id === 'dedge_cycle');
      return mk('edges', 'Edges', {
        message: lastEdge
          ? 'Last-edge parity: 11 edges are paired but the last one has its outer wings swapped. Put it at UF and flip its wings.'
          : `Pair up the edges: ${paired} of 12 done. Line matching wings up with an inner slice, swap the pair out with R U R', then undo the slice.`,
        progress: { done: paired, total: 12, unit: 'edges' },
        ...(lastEdge ? { matchedAlg: edgeFlip, matchKind: 'suggested' } : { matchedAlg: pairing, matchKind: 'suggested' }),
      });
    }
  }

  // From here the cube is a 3×3 (possibly with parity)
  const s = s3.map(face => face.map(row => row.map(c => c)));
  const inv = cubeInvariants(s);
  const ollParity = inv ? inv.flipSum % 2 === 1 : false;
  const pllParity = inv ? inv.cornerParity !== inv.edgeParity : false;
  const notes = [];
  if (isReduction) {
    notes.push(`Reduced to a 3×3: centers solved and all 12 edges paired.`);
  }
  // Both invariants are global, so parity can be predicted long before the last layer
  const headsUp = () => {
    if (ollParity) notes.push('Heads-up: the edge flips already sum to an odd number, so you will meet OLL parity at the last layer.');
    if (pllParity) notes.push('Heads-up: the edge and corner permutations already have different parities, so you will meet PLL parity at the last layer.');
  };

  // ── Cross ──
  if (!isCrossDone(s)) {
    const dColor = s[D][1][1];
    headsUp();
    notes.push('The detector reads the centers, so you can hold the cube any way: x2 puts the opposite color on the bottom.');
    return mk('cross', 'Cross', {
      message: `Build the ${colorName(dColor)} cross on the D face, each edge matching its side center.`,
      progress: { done: crossCount(s), total: 4, unit: 'cross edges' },
      notes,
    });
  }

  // ── F2L ──
  if (!isF2LDone(s)) {
    headsUp();
    return mk('f2l', 'F2L', {
      message: 'Cross done. Insert the four corner–edge pairs (F2L).',
      progress: { done: f2lSlotCount(s), total: 4, unit: 'F2L slots' },
      notes,
    });
  }

  // ── OLL (and OLL parity) ──
  if (!isOLLDone(s)) {
    const edgeInfo = describeOLLEdges(s);
    if (ollParity) {
      // Verify on the real cube that the library algorithm restores invariant (1)
      const fix = findMatch(state, candidates('Big Cube', N).filter(a => a.id === 'edge_flip'), (st) => {
        const r3 = reduceTo3x3(st);
        const i2 = r3.every(face => face.every(row => row.every(c => c !== null))) && cubeInvariants(r3);
        return !!i2 && i2.flipSum % 2 === 0 && isF2LDone(r3);
      });
      notes.push(`Invariant broken: the edge flips sum to ${inv.flipSum}, an odd number. On a 3×3 this sum is always even, so no 3×3 algorithm can fix it.`);
      return mk('oll-parity', 'OLL parity', {
        message: 'OLL parity: an odd number of top edges are flipped. Fix it first with the parity algorithm, then do a normal OLL.',
        edgeInfo,
        notes,
        ...withMatch(fix),
      });
    }
    const match = findMatch(s, candidates('OLL', 3), st => isOLLDone(st) && isF2LDone(st));
    headsUp();
    return mk('oll', 'OLL', {
      message: match
        ? `Detected: ${match.alg.name} orients the top layer.`
        : `Orient the top layer. Edge pattern: ${edgeInfo.label}.`,
      edgeInfo,
      notes,
      ...withMatch(match),
    });
  }

  // ── PLL (and PLL parity) ──
  if (pllParity) {
    const fix = findMatch(state, candidates('Big Cube', N).filter(a => a.id === 'pll_parity'), (st) => {
      const r3 = reduceTo3x3(st);
      const i2 = r3.every(face => face.every(row => row.every(c => c !== null))) && cubeInvariants(r3);
      return !!i2 && i2.cornerParity === i2.edgeParity && isOLLDone(r3) && isF2LDone(r3);
    });
    notes.push('Invariant broken: the edges form an odd permutation but the corners an even one (or vice versa). On a 3×3 the two parities always match, so no 3×3 PLL can solve this.');
    return mk('pll-parity', 'PLL parity', {
      message: 'PLL parity: two edges are swapped in a way no 3×3 PLL can fix. Apply the parity algorithm, then finish with a normal PLL.',
      notes,
      ...withMatch(fix),
    });
  }

  const match = findMatch(s, candidates('PLL', 3), isSolved, { post: true });
  return mk('pll', 'PLL', {
    message: match
      ? `Detected: ${match.alg.name} permutes the last layer.`
      : 'Last layer oriented. Permute the pieces (PLL).',
    notes,
    ...withMatch(match),
  });
}
