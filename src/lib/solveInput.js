/**
 * solveInput.js - turn any N×N cube state into a 3×3 the two-phase solver
 * can solve, plus the moves (if any) that must come first.
 *
 *   3×3        read the colors relative to the centers
 *   2×2        its corners on a virtual 3×3, with the DBL corner fixing the
 *              frame; the phantom edges get the corners' permutation parity
 *   4×4, 5×5   once reduced (centers solved, edges paired): fix OLL / PLL
 *              parity with the library algorithms, then solve the reduced 3×3
 *              with outer turns, which act on the big cube exactly like 3×3
 *              turns act on a 3×3
 */
import { applyMoveSequence } from './cubeState';
import { ALGORITHMS } from './algorithms';
import { reduceTo3x3, cubeInvariants } from './patternRecognition';
import { faceletsToCubie } from './twophase';

const D = 3, L = 4, B = 5;
// White/yellow, red/orange, green/blue: color c is opposite color (c + 3) % 6
const opposite = (c) => (c + 3) % 6;

/** 54 face labels from a 3×3 state, reading each color by the center that has it */
function labelsByCenters(s3) {
  const faceOfColor = {};
  s3.forEach((face, f) => { faceOfColor[face[1][1]] = f; });
  if (Object.keys(faceOfColor).length !== 6) return null;
  return s3.flat(2).map(c => faceOfColor[c]);
}

function permParity(perm) {
  let p = 0;
  for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) if (perm[j] < perm[i]) p ^= 1;
  return p;
}

/** 2×2 → virtual 3×3 face labels */
function labels2x2(state) {
  // The DBL corner defines the frame: its D, B and L stickers name those faces
  const dColor = state[D][1][0], bColor = state[B][1][1], lColor = state[L][1][0];
  const faceColor = [opposite(dColor), opposite(lColor), opposite(bColor), dColor, lColor, bColor];
  const faceOfColor = {};
  faceColor.forEach((c, f) => { faceOfColor[c] = f; });
  if (Object.keys(faceOfColor).length !== 6) return null;

  const f = new Array(54);
  for (let face = 0; face < 6; face++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const isCorner = r !== 1 && c !== 1;
        f[face * 9 + r * 3 + c] = isCorner
          ? faceOfColor[state[face][r === 0 ? 0 : 1][c === 0 ? 0 : 1]]
          : face; // centers and phantom edges start solved
      }
    }
  }
  // A 2×2 can have an odd corner permutation; give the phantom edges the same
  // parity (swap the UF and UB edges) so the virtual 3×3 is a legal position.
  try {
    if (permParity(Array.from(faceletsToCubie(f).cp)) === 1) {
      [f[19], f[46]] = [f[46], f[19]];
    }
  } catch {
    return null;
  }
  return f;
}

/**
 * Returns one of
 *   { ok: true, facelets, prefix: [{ label, notation }] }
 *   { ok: false, reason }
 */
export function buildSolveInput(state, N) {
  if (N === 2) {
    const facelets = labels2x2(state);
    return facelets ? { ok: true, facelets, prefix: [] } : { ok: false, reason: 'The corner colors do not form a valid 2×2.' };
  }
  if (N === 3) {
    const facelets = labelsByCenters(state);
    return facelets ? { ok: true, facelets, prefix: [] } : { ok: false, reason: 'The six centers must all have different colors.' };
  }

  // Big cube: must be reduced first
  const reduced = (st) => {
    const s3 = reduceTo3x3(st);
    return s3.every(face => face.every(row => row.every(c => c !== null))) ? s3 : null;
  };
  let st = state;
  let s3 = reduced(st);
  if (!s3) {
    return { ok: false, reason: 'Solve the centers and pair all 12 edges first; then the solver can finish the cube.' };
  }
  const prefix = [];
  const applyFix = (id, label) => {
    const alg = ALGORITHMS.find(a => a.id === id);
    st = applyMoveSequence(st, alg.notation);
    prefix.push({ label, notation: alg.notation, name: alg.name });
    s3 = reduced(st);
  };
  let inv = cubeInvariants(s3);
  if (!inv) return { ok: false, reason: 'The centers are in an impossible arrangement.' };
  if (inv.flipSum % 2 === 1) {
    applyFix('edge_flip', 'OLL parity');
    inv = s3 && cubeInvariants(s3);
  }
  if (inv && inv.cornerParity !== inv.edgeParity) {
    applyFix('pll_parity', 'PLL parity');
    inv = s3 && cubeInvariants(s3);
  }
  if (!s3 || !inv || inv.flipSum % 2 === 1 || inv.cornerParity !== inv.edgeParity) {
    return { ok: false, reason: 'Could not fix the parity of this position.' };
  }
  const facelets = labelsByCenters(s3);
  return facelets ? { ok: true, facelets, prefix } : { ok: false, reason: 'The centers are in an impossible arrangement.' };
}
