/**
 * patternRecognition.js
 *
 * Detects the current "stage" of a 3×3 Rubik's cube solve and suggests
 * which algorithm from the library would apply.
 *
 * Stages (in order):
 *   scrambled → cross → f2l → oll → pll → solved
 *
 * For OLL/PLL, we use a forward-simulation approach:
 *   for each candidate algorithm, try applying it (in all 4 U-face rotations)
 *   and check if the result reaches the next stage.
 * This avoids pre-computing fingerprints and handles rotations automatically.
 */

import { applyMove, applyMoveSequence, isSolved } from './cubeState';
import { ALGORITHMS } from './algorithms';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Is the U face completely one color (all U-colored = 0)? */
export function isOLLDone(state) {
  return state[0].every(row => row.every(c => c === 0));
}

/**
 * Is F2L complete?
 * Checks D face (all yellow=3) + rows 1 and 2 of each side face
 * (rows 0 belong to the U-layer which OLL will fix).
 */
export function isF2LDone(state) {
  const N = state[0].length;
  if (N !== 3) return false;

  // D face: all 3 (yellow)
  if (!state[3].every(row => row.every(c => c === 3))) return false;

  // Side faces 1=R,2=F,4=L,5=B: rows 1 and 2 must match their face color
  for (const f of [1, 2, 4, 5]) {
    for (let r = 1; r < N; r++) {
      if (!state[f][r].every(c => c === f)) return false;
    }
  }
  return true;
}

/**
 * Is a white cross on top?
 * Checks the 4 edge middles of the U face (not alignment with sides).
 */
export function isCrossDone(state) {
  return (
    state[0][0][1] === 0 &&
    state[0][1][0] === 0 &&
    state[0][1][2] === 0 &&
    state[0][2][1] === 0
  );
}

/** Apply n clockwise U-layer turns (AUF = Adjust U Face) */
function applyAUF(state, n) {
  let s = state;
  for (let i = 0; i < n % 4; i++) {
    s = applyMove(s, 'U', 0, true);
  }
  return s;
}

/** Describe the OLL edge pattern for educational display */
function describeOLLEdges(state) {
  const isU = c => c === 0;
  const fEdge = isU(state[2][0][1]);
  const rEdge = isU(state[1][0][1]);
  const bEdge = isU(state[5][0][1]);
  const lEdge = isU(state[4][0][1]);

  const count = [fEdge, rEdge, bEdge, lEdge].filter(Boolean).length;

  if (count === 0) return { pattern: 'dot', label: 'Dot — no edges oriented' };
  if (count === 4) return { pattern: 'cross', label: 'Cross — all 4 edges oriented' };
  if (count === 2) {
    const isLine = (fEdge && bEdge) || (rEdge && lEdge);
    return isLine
      ? { pattern: 'line', label: 'Line — 2 opposite edges oriented' }
      : { pattern: 'L', label: 'L-shape — 2 adjacent edges oriented' };
  }
  if (count === 1) return { pattern: 'arrow', label: 'Arrow — 1 edge oriented' };
  return { pattern: 'unknown', label: `${count}/4 edges oriented` };
}

// ── Main detection ─────────────────────────────────────────────────────────

/**
 * Detect the current solve stage and suggest matching algorithms.
 *
 * Returns:
 * {
 *   stage: 'solved'|'pll'|'oll'|'f2l'|'cross'|'scrambled',
 *   stageLabel: string,      // human-readable stage name
 *   message: string,         // what to do next
 *   matchedAlg: object|null, // algorithm from library that applies, if found
 *   edgeInfo: object|null,   // OLL edge pattern info
 * }
 */
export function detectPattern(state, N) {
  if (N !== 3) {
    return {
      stage: 'other',
      stageLabel: `${N}×${N}`,
      message: 'Pattern detection is available for 3×3 only.',
      matchedAlg: null,
      edgeInfo: null,
    };
  }

  // ── Solved ──
  if (isSolved(state)) {
    return {
      stage: 'solved',
      stageLabel: 'Solved',
      message: 'The cube is solved. Try a scramble or explore algorithms.',
      matchedAlg: null,
      edgeInfo: null,
    };
  }

  const f2l = isF2LDone(state);
  const oll = f2l && isOLLDone(state);

  // ── PLL stage (F2L + OLL done, need permutation) ──
  if (oll) {
    const match = findMatchingPLL(state);
    return {
      stage: 'pll',
      stageLabel: 'PLL',
      message: match
        ? `Detected: ${match.name} — apply it to solve.`
        : 'Last layer oriented. Now permute the pieces (PLL).',
      matchedAlg: match,
      edgeInfo: null,
    };
  }

  // ── OLL stage (F2L done, need orientation) ──
  if (f2l) {
    const edgeInfo = describeOLLEdges(state);
    const match = findMatchingOLL(state);
    return {
      stage: 'oll',
      stageLabel: 'OLL',
      message: match
        ? `Detected: ${match.name} — apply it to orient the top layer.`
        : `Top layer needs orientation. Edge pattern: ${edgeInfo.label}.`,
      matchedAlg: match,
      edgeInfo,
    };
  }

  // ── Cross stage ──
  if (isCrossDone(state)) {
    return {
      stage: 'f2l',
      stageLabel: 'F2L',
      message: 'White cross complete — insert the 4 corner-edge pairs (F2L).',
      matchedAlg: null,
      edgeInfo: null,
    };
  }

  // ── Scrambled ──
  return {
    stage: 'scrambled',
    stageLabel: 'Scrambled',
    message: 'Start by forming the white cross on the U face.',
    matchedAlg: null,
    edgeInfo: null,
  };
}

// ── Algorithm matching ──────────────────────────────────────────────────────

/**
 * Try each OLL algorithm (in all 4 AUF rotations).
 * If applying it completes the U face (OLL done), return that algorithm.
 */
function findMatchingOLL(state) {
  const ollAlgs = ALGORITHMS.filter(a => a.category === 'OLL' && a.cubeSize.includes(3));
  for (const alg of ollAlgs) {
    for (let auf = 0; auf < 4; auf++) {
      const s = applyAUF(state, auf);
      try {
        const result = applyMoveSequence(s, alg.notation);
        if (isOLLDone(result)) return alg;
      } catch (_) { /* skip bad notation */ }
    }
  }
  return null;
}

/**
 * Try each PLL algorithm (in all 4 AUF rotations).
 * If applying it solves the cube, return that algorithm.
 * Note: PLL might require an AUF after the algorithm too — we skip that
 * for simplicity (most PLL algorithms end aligned).
 */
function findMatchingPLL(state) {
  const pllAlgs = ALGORITHMS.filter(a => a.category === 'PLL' && a.cubeSize.includes(3));
  for (const alg of pllAlgs) {
    for (let auf = 0; auf < 4; auf++) {
      const s = applyAUF(state, auf);
      try {
        const result = applyMoveSequence(s, alg.notation);
        // Accept if solved, or if only a U-layer rotation away from solved
        for (let post = 0; post < 4; post++) {
          if (isSolved(applyAUF(result, post))) return alg;
        }
      } catch (_) { /* skip bad notation */ }
    }
  }
  return null;
}
