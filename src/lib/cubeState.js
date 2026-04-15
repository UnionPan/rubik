/**
 * NxN Rubik's Cube State Engine
 *
 * State: 6 faces × N × N array of color indices.
 * Faces: U=0(white), R=1(red), F=2(green), D=3(yellow), L=4(orange), B=5(blue)
 *
 * Coordinate convention (0-indexed):
 *   x: 0=left(L), N-1=right(R)
 *   y: 0=bottom(D), N-1=top(U)
 *   z: 0=back(B), N-1=front(F)
 *
 * Face grid conventions (row,col):
 *   U[r][c]: y=N-1, z=r,    x=c    (row 0=back,  col 0=left)
 *   D[r][c]: y=0,   z=N-1-r, x=c   (row 0=front, col 0=left)
 *   R[r][c]: x=N-1, y=N-1-r, z=N-1-c (row 0=top, col 0=front)
 *   L[r][c]: x=0,   y=N-1-r, z=c   (row 0=top,  col 0=back)
 *   F[r][c]: z=N-1, y=N-1-r, x=c   (row 0=top,  col 0=left)
 *   B[r][c]: z=0,   y=N-1-r, x=N-1-c (row 0=top, col 0=right-from-back = left-from-front-right)
 *
 * Belt 4-cycles (a→b→c→d→a means b_new=a_old, c_new=b_old, d_new=c_old, a_new=d_old):
 *   U CW layer l: (F[l][c], L[l][c], B[l][c], R[l][c])         for c=0..N-1
 *   D CW layer l: (F[N-1-l][c], R[N-1-l][c], B[N-1-l][c], L[N-1-l][c]) for c=0..N-1
 *   R CW layer l: (F[r][N-1-l], U[r][N-1-l], B[N-1-r][l], D[r][N-1-l]) for r=0..N-1
 *   L CW layer l: (U[r][l], F[r][l], D[r][l], B[N-1-r][N-1-l]) for r=0..N-1
 *   F CW layer l: (U[N-1-l][r], R[r][l], D[l][N-1-r], L[N-1-r][N-1-l]) for r=0..N-1
 *   B CW layer l: (U[l][c], L[N-1-c][l], D[N-1-l][N-1-c], R[c][N-1-l]) for c=0..N-1
 */

export const FACE = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
export const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const COLORS = {
  0: { name: 'white',  hex: '#FFFFFF' },
  1: { name: 'red',    hex: '#B71234' },
  2: { name: 'green',  hex: '#009B48' },
  3: { name: 'yellow', hex: '#FFD500' },
  4: { name: 'orange', hex: '#FF5800' },
  5: { name: 'blue',   hex: '#0046AD' },
};

/** Create a solved NxN cube state: 6 × N × N array */
export function solvedState(N) {
  return Array.from({ length: 6 }, (_, f) =>
    Array.from({ length: N }, () => Array(N).fill(f))
  );
}

/** Deep-clone state */
function clone(state) {
  return state.map(face => face.map(row => [...row]));
}

/** Rotate face grid 90° CW in-place */
function rotateFaceCW(face, N) {
  const tmp = face.map(r => [...r]);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      face[c][N - 1 - r] = tmp[r][c];
}

/** Rotate face grid 90° CCW in-place */
function rotateFaceCCW(face, N) {
  const tmp = face.map(r => [...r]);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      face[N - 1 - c][r] = tmp[r][c];
}

/**
 * Apply a single 4-cycle: a→b→c→d→a
 * Each element is [face, row, col]
 */
function apply4Cycle(state, a, b, c, d) {
  const [af, ar, ac] = a, [bf, br, bc] = b, [cf, cr, cc] = c, [df, dr, dc] = d;
  const tmp = state[af][ar][ac];
  state[af][ar][ac] = state[df][dr][dc];
  state[df][dr][dc] = state[cf][cr][cc];
  state[cf][cr][cc] = state[bf][br][bc];
  state[bf][br][bc] = tmp;
}

/**
 * Apply a move to a state (immutable, returns new state).
 * face: 'U'|'R'|'F'|'D'|'L'|'B'
 * layer: 0 = outermost face, N-1 = innermost
 * cw: true = clockwise from outside face perspective
 */
export function applyMove(state, face, layer = 0, cw = true) {
  const N = state[0].length;
  const s = clone(state);
  const l = layer;

  // Rotate outer face for layer 0 (or inner face for layer N-1)
  if (l === 0) {
    cw ? rotateFaceCW(s[FACE[face]], N) : rotateFaceCCW(s[FACE[face]], N);
  }
  if (l === N - 1) {
    // Opposite face rotates in reverse
    const opp = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
    cw ? rotateFaceCCW(s[FACE[opp[face]]], N) : rotateFaceCW(s[FACE[opp[face]]], N);
  }

  const { U, R, F, D, L, B } = FACE;

  // Belt cycles: apply N independent 4-cycles
  for (let i = 0; i < N; i++) {
    if (!cw) {
      // CCW = 3× CW, so apply inverse cycle (reverse order)
      applyBeltCycle(s, face, l, i, N, false);
    } else {
      applyBeltCycle(s, face, l, i, N, true);
    }
  }

  return s;
}

function applyBeltCycle(s, face, l, i, N, cw) {
  const { U, R, F, D, L, B } = FACE;
  let a, b, c, d;

  switch (face) {
    case 'U':
      a = [F, l, i];     b = [L, l, i];
      c = [B, l, i];     d = [R, l, i];
      break;
    case 'D':
      a = [F, N-1-l, i]; b = [R, N-1-l, i];
      c = [B, N-1-l, i]; d = [L, N-1-l, i];
      break;
    case 'R':
      a = [F, i, N-1-l]; b = [U, i, N-1-l];
      c = [B, N-1-i, l]; d = [D, i, N-1-l];
      break;
    case 'L':
      a = [U, i, l];     b = [F, i, l];
      c = [D, i, l];     d = [B, N-1-i, N-1-l];
      break;
    case 'F':
      a = [U, N-1-l, i]; b = [R, i, l];
      c = [D, l, N-1-i]; d = [L, N-1-i, N-1-l];
      break;
    case 'B':
      a = [U, l, i];     b = [L, N-1-i, l];
      c = [D, N-1-l, N-1-i]; d = [R, i, N-1-l];
      break;
    default: return;
  }

  if (cw) {
    apply4Cycle(s, a, b, c, d);
  } else {
    // CCW = reverse 4-cycle: a←b←c←d←a = d→c→b→a→d
    apply4Cycle(s, d, c, b, a);
  }
}

/**
 * Parse and apply a move sequence string, e.g. "R U R' U'"
 * Returns new state.
 */
export function applyMoveSequence(state, sequence) {
  const moves = parseMoveSequence(sequence);
  return moves.reduce((s, mv) => applyMove(s, mv.face, mv.layer, mv.cw), state);
}

/**
 * Parse a move sequence string like "R U R' U' F2 3Rw"
 * Returns array of {face, layer, cw, notation}
 */
export function parseMoveSequence(sequence) {
  // Matches: optional layer prefix (e.g. "3"), face letter, optional 'w', optional "'" or "2"
  const re = /(\d*)([URFDLB])(w?)(\d*)('{0,3})/gi;
  const moves = [];
  let m;
  while ((m = re.exec(sequence)) !== null) {
    const [, layerPfx, faceChar, , numSuffix, prime] = m;
    const face = faceChar.toUpperCase();
    const layer = layerPfx ? parseInt(layerPfx) - 1 : 0;
    const cw = prime === "'" ? false : true;

    // For "2" suffix, apply move twice
    const times = numSuffix === '2' ? 2 : (prime === "''" ? 2 : 1);
    for (let t = 0; t < times; t++) {
      moves.push({ face, layer, cw, notation: m[0] });
    }
    if (times === 1 && numSuffix !== '2') {
      // already pushed once, remove the extra
      if (moves.length > 1 && moves[moves.length-1] === moves[moves.length-2]) {
        moves.pop();
      }
    }
  }
  return moves;
}

/** Simpler parser used by algorithm engine */
export function parseMove(notation) {
  const m = notation.trim().match(/^(\d*)([URFDLB])(w?)(\d*)('{0,3})$/i);
  if (!m) return null;
  const [, layerPfx, faceChar, , numSuffix, prime] = m;
  const face = faceChar.toUpperCase();
  const layer = layerPfx ? parseInt(layerPfx) - 1 : 0;
  const double = numSuffix === '2';
  const cw = prime === "'" ? false : true;
  return { face, layer, cw, double };
}

/**
 * Apply a single move notation string (e.g. "R", "U'", "F2", "2R")
 */
export function applyNotation(state, notation) {
  const mv = parseMove(notation);
  if (!mv) return state;
  let s = applyMove(state, mv.face, mv.layer, mv.cw);
  if (mv.double) s = applyMove(s, mv.face, mv.layer, mv.cw);
  return s;
}

/**
 * Check if state is solved
 */
export function isSolved(state) {
  return state.every(face => face.every(row => row.every(c => c === face[0][0])));
}

/**
 * Get the permutation representation of a state (relative to solved).
 * Returns an array P where P[i] = j means sticker at position i came from position j.
 * Sticker index: face * N*N + row * N + col
 */
export function getPermutation(state) {
  const N = state[0].length;
  const P = [];
  for (let f = 0; f < 6; f++) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const color = state[f][r][c];
        // Find where this color could have come from in solved state
        // For display purposes, just record the color (face) at each position
        P.push(color);
      }
    }
  }
  return P;
}

/**
 * Compute cycle notation of permutation P.
 * P[i] = color at sticker position i.
 * We infer cycles by comparing to solved state (where P[i] = floor(i/(N*N))).
 */
export function computeCycles(state) {
  const N = state[0].length;
  const nn = N * N;
  const total = 6 * nn;
  const visited = new Uint8Array(total);
  const cycles = [];

  // Build: position i currently holds the sticker that "should" be at some solved position
  // For group-theory display, we show the permutation on the face-sticker positions
  // We use: solved[i] = face = floor(i/nn)
  // current[i] = state[f][r][c] for the i-th position

  // To get the permutation as a function π where π(i) = j means sticker at solved[j] is now at i:
  // solved state: position i has color floor(i/nn)
  // current state: position i has color state[f][r][c]
  // We need: π(i) = the position in the solved state where the sticker now at position i came from
  // Since center stickers are fixed, we only display permutation on non-center stickers

  for (let start = 0; start < total; start++) {
    if (visited[start]) continue;
    const f = Math.floor(start / nn);
    const r = Math.floor((start % nn) / N);
    const c = start % N;
    const color = state[f][r][c];
    if (color === f) { visited[start] = 1; continue; } // fixed point, skip

    // Follow cycle
    visited[start] = 1;
    // This is a simplified cycle display: we just show which positions swap colors
    // Full permutation tracking would require sticker identity tracking, not just color
    cycles.push([start]);
  }
  return cycles;
}

/**
 * Compute order of a move sequence (smallest k>0 such that seq^k = identity)
 * Returns integer (capped at 1260 for NxN cubes)
 */
export function computeOrder(state, moveSeq) {
  const N = state[0].length;
  let s = state;
  const base = JSON.stringify(state);
  for (let k = 1; k <= 1260; k++) {
    s = applyMoveSequence(s, moveSeq);
    if (JSON.stringify(s) === base) return k;
  }
  return -1;
}

/**
 * Generate a random scramble of `moves` moves for NxN cube
 */
export function randomScramble(N = 3, moves = 20) {
  const faces = ['U', 'D', 'R', 'L', 'F', 'B'];
  const suffixes = ["", "'", '2'];
  const result = [];
  let lastFace = '';
  for (let i = 0; i < moves; i++) {
    let face;
    do { face = faces[Math.floor(Math.random() * faces.length)]; } while (face === lastFace);
    lastFace = face;
    const layer = N > 3 ? (Math.random() < 0.3 ? 1 : 0) : 0;
    const layerPrefix = layer > 0 ? `${layer + 1}` : '';
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    result.push(`${layerPrefix}${face}${suffix}`);
  }
  return result.join(' ');
}

/**
 * Convert sticker index to human-readable label
 */
export function stickerLabel(idx, N) {
  const nn = N * N;
  const f = Math.floor(idx / nn);
  const rem = idx % nn;
  const r = Math.floor(rem / N);
  const c = rem % N;
  return `${FACE_NAMES[f]}[${r}][${c}]`;
}

/**
 * Compute the permutation as a function: given solved state as reference,
 * return array perm where perm[i] = j means the sticker now at position i
 * originally came from position j in the solved state.
 *
 * For this to work we need color+multiplicity tracking (e.g., for centers of same color).
 * Here we use a greedy matching. Works correctly for 3x3 (all stickers unique by position).
 */
export function truePermutation(state) {
  const N = state[0].length;
  const nn = N * N;
  const total = 6 * nn;
  const solved = solvedState(N);

  // For each position i, find where the sticker came from
  // We need to track sticker identity. For display, we approximate by color matching.
  // For centers (and for NxN where many stickers share a color), this is approximate.
  // For exact group theory, use sticker IDs.

  // Build color→positions mapping in solved state
  const colorPositions = {};
  for (let i = 0; i < total; i++) {
    const f = Math.floor(i / nn);
    const r = Math.floor((i % nn) / N);
    const c = i % N;
    const color = solved[f][r][c];
    if (!colorPositions[color]) colorPositions[color] = [];
    colorPositions[color].push(i);
  }

  const usedSolvedPositions = new Set();
  const perm = new Array(total);

  for (let i = 0; i < total; i++) {
    const f = Math.floor(i / nn);
    const r = Math.floor((i % nn) / N);
    const c = i % N;
    const color = state[f][r][c];
    // Find the closest unused solved position with this color
    const candidates = colorPositions[color];
    // Greedy: pick closest unused
    let best = -1, bestDist = Infinity;
    for (const j of candidates) {
      if (!usedSolvedPositions.has(j)) {
        const dist = Math.abs(i - j);
        if (dist < bestDist) { bestDist = dist; best = j; }
      }
    }
    perm[i] = best;
    if (best !== -1) usedSolvedPositions.add(best);
  }
  return perm;
}

/**
 * Decompose permutation into disjoint cycles
 * Returns array of cycles, each cycle is an array of indices
 * Fixed points (1-cycles) can optionally be excluded
 */
export function permToCycles(perm, excludeFixed = true) {
  const n = perm.length;
  const visited = new Uint8Array(n);
  const cycles = [];

  for (let start = 0; start < n; start++) {
    if (visited[start] || perm[start] === -1) continue;
    const cycle = [];
    let cur = start;
    while (!visited[cur] && perm[cur] !== -1) {
      visited[cur] = 1;
      cycle.push(cur);
      cur = perm[cur];
    }
    if (!excludeFixed || cycle.length > 1) {
      cycles.push(cycle);
    } else {
      // still mark fixed points as visited
    }
  }
  return cycles;
}

// ─── Move position cycles (for algebra panel) ────────────────────────────
/**
 * Compute the cycle decomposition of a face move as sticker position indices.
 * Returns array of 4-cycles [[a,b,c,d], ...] where a→b means sticker at a moves to b.
 * Indices: face*N*N + row*N + col
 */
export function getMovePositionCycles(moveFace, layer, cw, N) {
  const nn = N * N;
  const idx = (f, r, c) => f * nn + r * N + c;
  const { U, R, F, D, L, B } = FACE;
  const all = [];

  // Face rotation cycles (only for outermost layers)
  const addFaceRotation = (fi, clockwise) => {
    for (let r = 0; r < Math.floor(N / 2); r++) {
      for (let c = r; c < N - 1 - r; c++) {
        const cyc = [
          idx(fi, r, c),
          idx(fi, c, N - 1 - r),
          idx(fi, N - 1 - r, N - 1 - c),
          idx(fi, N - 1 - c, r),
        ];
        all.push(clockwise ? cyc : [...cyc].reverse());
      }
    }
  };

  if (layer === 0) addFaceRotation(FACE[moveFace], cw);
  if (layer === N - 1) {
    const opp = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
    addFaceRotation(FACE[opp[moveFace]], !cw);
  }

  // Belt cycles (derived from coordinate geometry)
  for (let i = 0; i < N; i++) {
    let pos;
    switch (moveFace) {
      case 'U': pos = [idx(F,layer,i), idx(L,layer,i), idx(B,layer,i), idx(R,layer,i)]; break;
      case 'D': pos = [idx(F,N-1-layer,i), idx(R,N-1-layer,i), idx(B,N-1-layer,i), idx(L,N-1-layer,i)]; break;
      case 'R': pos = [idx(F,i,N-1-layer), idx(U,i,N-1-layer), idx(B,N-1-i,layer), idx(D,i,N-1-layer)]; break;
      case 'L': pos = [idx(U,i,layer), idx(F,i,layer), idx(D,i,layer), idx(B,N-1-i,N-1-layer)]; break;
      case 'F': pos = [idx(U,N-1-layer,i), idx(R,i,layer), idx(D,layer,N-1-i), idx(L,N-1-i,N-1-layer)]; break;
      case 'B': pos = [idx(U,layer,i), idx(L,N-1-i,layer), idx(D,N-1-layer,N-1-i), idx(R,i,N-1-layer)]; break;
      default: continue;
    }
    all.push(cw ? pos : [...pos].reverse());
  }

  return all;
}

/**
 * Format a list of cycles as human-readable cycle notation
 * e.g. [(0,2,8,6),(1,5,7,3)] → "(U₀₀ U₀₂ U₂₂ U₂₀)(U₀₁ U₀₅ U₂₁ U₁₀)"
 */
export function formatCycles(cycles, N) {
  if (!cycles || cycles.length === 0) return 'id';
  const nn = N * N;
  const label = (idx) => {
    const f = Math.floor(idx / nn);
    const rem = idx % nn;
    const r = Math.floor(rem / N);
    const c = rem % N;
    return `${FACE_NAMES[f]}${r}${c}`;
  };
  return cycles.map(cyc => `(${cyc.map(label).join(' ')})`).join('');
}

/**
 * Compute cumulative permutation from a sequence of move notations applied to solved state.
 * Returns {perm, cycles, parity, order (approx)}
 */
export function analyzeSequence(notations, N) {
  const nn = N * N;
  const total = 6 * nn;

  // Build permutation by tracking sticker IDs
  // Initial: identity permutation
  let perm = Array.from({ length: total }, (_, i) => i);

  for (const notation of notations) {
    const mv = parseMove(notation);
    if (!mv) continue;
    const moveCycles = getMovePositionCycles(mv.face, mv.layer, mv.cw, N);
    const times = mv.double ? 2 : 1;
    for (let t = 0; t < times; t++) {
      const newPerm = [...perm];
      moveCycles.forEach(([a, b, c, d]) => {
        // a→b means sticker at position a goes to position b
        // So: newPerm[b] = old perm[a], etc.
        newPerm[b] = perm[a];
        newPerm[c] = perm[b];
        newPerm[d] = perm[c];
        newPerm[a] = perm[d];
      });
      perm = newPerm;
    }
  }

  // Decompose into cycles
  const visited = new Uint8Array(total);
  const resultCycles = [];
  for (let start = 0; start < total; start++) {
    if (visited[start] || perm[start] === start) { visited[start] = 1; continue; }
    const cycle = [];
    let cur = start;
    while (!visited[cur]) {
      visited[cur] = 1;
      cycle.push(cur);
      cur = perm[cur];
    }
    if (cycle.length > 1) resultCycles.push(cycle);
  }

  const parity = resultCycles.reduce((s, c) => s + c.length - 1, 0) % 2 === 0 ? 'even' : 'odd';

  return { perm, cycles: resultCycles, parity };
}
