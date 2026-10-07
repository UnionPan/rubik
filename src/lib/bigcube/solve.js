/**
 * Solve a scrambled 4×4 or 5×5 by reduction, the way people do it:
 *
 *   Centers   three table-guided searches (centers.js), then on the 5×5
 *             3-cycles for the +-centers (centerCycles.js)
 *   Parity    the edge-flip algorithm, when the edges are an odd permutation
 *   Edges     3-cycles of wings that keep the centers (see edges.js); on the
 *             4×4 the target already includes the PLL-parity swap if needed
 *   3×3       the reduced cube, solved by the two-phase solver with outer turns
 *
 * Returns { stages: [{ id, label, turns }] } with quarter turns for the app.
 */
import { applyTurn, parseMoveSequence, solvedState, applyMoveSequence } from '../cubeState';
import { buildSolveInput } from '../solveInput';
import { ALGORITHMS } from '../algorithms';
import { solveFacelets } from '../twophase';
import { bigCubeMoves, flatten, permute, simplify, toTurns } from './moves';
import { centerSolver, solveCenters } from './centers';
import { plusCenterSolver, solvePlusCenters } from './centerCycles';
import { edgeSolver, pieces, solveWings, targetParity, wingTargets } from './edges';

/** The 24 ways the six colors can sit on the faces (rotations of solved) */
const ORIENTATIONS = (() => {
  const seen = new Map();
  const queue = [solvedState(3)];
  while (queue.length) {
    const st = queue.shift();
    const colors = st.map(face => face[1][1]);
    const key = colors.join();
    if (seen.has(key)) continue;
    seen.set(key, colors);
    for (const rot of ['x', 'y']) queue.push(applyMoveSequence(st, rot));
  }
  return [...seen.values()];
})();

/** Corner permutation parity relative to the colors that belong on each face */
function cornerParity(N, flat, colorOf) {
  const NN = N * N;
  const corners = pieces(N).filter(p => p.stickers.length === 3).map(p => p.stickers);
  const key = (cols) => [...cols].sort().join();
  const homeKey = corners.map(st => key(st.map(s => colorOf[Math.floor(s / NN)])));
  const perm = corners.map(st => homeKey.indexOf(key(st.map(s => flat[s]))));
  return targetParity(perm);
}

/** Quarter turns → move indices of bigCubeMoves(N) */
function turnsToMoves(N, turns) {
  const { byKey } = bigCubeMoves(N);
  return turns.map(t => byKey.get(`${t.face}${t.layers[0]}${t.cw ? 1 : 3}`));
}

function toState(N, flat) {
  return Array.from({ length: 6 }, (_, f) =>
    Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => flat[f * N * N + r * N + c])));
}

export function solveBigCube(state, N, { onProgress } = {}) {
  const { moves } = bigCubeMoves(N);
  const NN = N * N;
  let flat = flatten(state);
  const run = (seq) => { for (const mi of seq) flat = permute(flat, moves[mi].perm); };

  // ── Centers ──
  onProgress?.('centers');
  const cs = centerSolver(N);
  let colorOf, centers;
  if (N % 2) {
    colorOf = [0, 1, 2, 3, 4, 5].map(f => flat[f * NN + ((N - 1) / 2) * N + (N - 1) / 2]);
    centers = solveCenters(cs, flat, colorOf);
  } else {
    // No fixed centers: try every color orientation, keep the shortest
    for (const o of ORIENTATIONS) {
      const c = solveCenters(cs, flat, o);
      const len = c && c.stages.reduce((a, s) => a + s.moves.length, 0);
      if (c && (!centers || len < centers.len)) { centers = { ...c, len }; colorOf = o; }
    }
  }
  if (!centers) throw new Error('Could not solve the centers');
  let centerMoves = centers.stages.flatMap(s => s.moves);
  run(centerMoves);
  if (cs.others.length) {
    const plus = solvePlusCenters(plusCenterSolver(N, cs.others[0]), flat, colorOf);
    run(plus);
    centerMoves = [...centerMoves, ...plus];
  }
  centerMoves = simplify(N, centerMoves);

  // ── Parity and edges ──
  onProgress?.('edges');
  const es = edgeSolver(N);
  const opts = { colorOf, swapUFUB: N % 2 === 0 && cornerParity(N, flat, colorOf) === 1 };
  let target = wingTargets(es, flat, opts);
  let parityMoves = [];
  if (targetParity(target) === 1) {
    const flipAlg = ALGORITHMS.find(a => a.id === 'edge_flip').notation;
    parityMoves = turnsToMoves(N, parseMoveSequence(flipAlg, N));
    run(parityMoves);
    target = wingTargets(es, flat, opts);
  }
  const wingMoves = simplify(N, solveWings(es, target));
  run(wingMoves);

  // ── The reduced 3×3 ──
  onProgress?.('3x3');
  const reduced = toState(N, flat);
  const input = buildSolveInput(reduced, N);
  if (!input.ok || input.prefix.length) throw new Error(`Reduction failed on ${N}: ${input.reason ?? input.prefix.map(p => p.label).join()} swap=${opts.swapUFUB} parityFix=${parityMoves.length > 0}`);
  const finish = parseMoveSequence(solveFacelets(input.facelets).moves.join(' '), N);
  const end = finish.reduce(applyTurn, reduced);
  if (!end.every(face => face.every(row => row.every(c => c === face[0][0])))) throw new Error('The solution does not solve the cube');

  const stages = [
    { id: 'centers', label: 'Centers', turns: toTurns(N, centerMoves) },
    ...(parityMoves.length ? [{ id: 'parity', label: 'Parity', turns: toTurns(N, parityMoves) }] : []),
    { id: 'edges', label: 'Edges', turns: toTurns(N, wingMoves) },
    { id: '3x3', label: '3×3', turns: finish },
  ];
  return { stages };
}
