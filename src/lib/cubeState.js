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

// ─── Notation ─────────────────────────────────────────────────────────────
//
// A *turn* is one quarter turn of one or more parallel layers:
//   { face, layers: number[], cw, notation }
// layer 0 is the named face, layer N-1 the opposite face.
//
// Native notation (WCA / SiGN, used for typed input and big-cube algorithms):
//   R R' R2       outer layer
//   2R  3R        a single inner layer (2nd, 3rd from R)
//   Rw  r  3Rw    wide: the outer 2 (or n) layers
//   M E S         middle slice (central slice on odd cubes, all inner slices
//                 on even cubes); M follows L, E follows D, S follows F
//   x y z         whole-cube rotation, following R, U, F
//
// Reduced notation (3×3 algorithms run on an N×N cube): the token is read as
// a 3×3 move, then each 3×3 layer is mapped to the big cube - outer layer to
// outer layer, the 3×3 middle slice to all inner slices.  That is how a 3×3
// algorithm acts on a big cube after reduction (centers and paired edges).

const TOKEN_RE = /^(\d*)([URFDLBMESxyzurfdlb])(w?)(2'|'2|2|')?$/;
const SLICE_FACE = { M: 'L', E: 'D', S: 'F' };
const ROTATION_FACE = { x: 'R', y: 'U', z: 'F' };

export class MoveParseError extends Error {}

const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);

/** Layers of a native token on an N×N cube, or throw */
function nativeLayers(token, prefix, letter, wide, N) {
  const n = prefix ? parseInt(prefix, 10) : null;
  if (ROTATION_FACE[letter]) {
    if (prefix || wide) throw new MoveParseError(`"${token}" is not a valid rotation`);
    return { face: ROTATION_FACE[letter], layers: range(0, N) };
  }
  if (SLICE_FACE[letter]) {
    if (prefix || wide) throw new MoveParseError(`"${token}" is not a valid slice move`);
    if (N < 3) throw new MoveParseError(`"${token}" needs a cube with inner layers`);
    const layers = N % 2 ? [(N - 1) / 2] : range(1, N - 1);
    return { face: SLICE_FACE[letter], layers };
  }
  const face = letter.toUpperCase();
  const isWide = wide || letter !== face; // Rw or r
  if (isWide) {
    const depth = n ?? 2;
    if (depth < 1 || depth > N) throw new MoveParseError(`"${token}" turns ${depth} layers, but the cube has ${N}`);
    return { face, layers: range(0, depth) };
  }
  const layer = (n ?? 1) - 1;
  if (layer < 0 || layer >= N) throw new MoveParseError(`"${token}" needs a cube with at least ${layer + 1} layers`);
  return { face, layers: [layer] };
}

/** Map a 3×3 layer index to N×N layers (reduction) */
function reducedLayers(layer3, N) {
  if (layer3 === 0) return [0];
  if (layer3 === 2) return [N - 1];
  return range(1, N - 1);
}

/**
 * Parse one token, e.g. "R", "U2", "Rw'", "2R", "M2", "x".
 * Returns { face, layers, cw, turns, token } (turns = 1 or 2).
 * Throws MoveParseError for unknown or impossible tokens.
 */
export function parseToken(token, N, { reduced = false } = {}) {
  const m = TOKEN_RE.exec(token);
  if (!m) throw new MoveParseError(`Unknown move "${token}"`);
  const [, prefix, letter, wide, suffix = ''] = m;
  const turns = suffix.includes('2') ? 2 : 1;
  const cw = !suffix.includes("'");

  let face, layers;
  if (reduced && N !== 3) {
    const base = nativeLayers(token, prefix, letter, wide, 3);
    face = base.face;
    layers = [...new Set(base.layers.flatMap(l => reducedLayers(l, N)))].filter(l => l >= 0 && l < N);
  } else {
    ({ face, layers } = nativeLayers(token, prefix, letter, wide, N));
  }
  return { face, layers, cw, turns, token };
}

/** Notation for one quarter turn of a parsed token ("Rw2'" → "Rw'") */
function quarterNotation(token) {
  return token.replace(/2'|'2/, "'").replace(/2$/, '');
}

/** Expand a parsed token into quarter turns */
export function expandToken(parsed) {
  const notation = parsed.turns === 2 ? quarterNotation(parsed.token) : parsed.token;
  const turn = { face: parsed.face, layers: parsed.layers, cw: parsed.cw, notation };
  return parsed.turns === 2 ? [turn, { ...turn }] : [turn];
}

/** Split a sequence into tokens; tolerates missing spaces ("RUR'U'") and brackets */
export function tokenizeSequence(sequence) {
  const cleaned = (sequence || '').replace(/[()[\],]/g, ' ');
  const tokens = [];
  const re = /(\d*)([URFDLBMESxyzurfdlb])(w?)(2'|'2|2|')?/g;
  let last = 0;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const gap = cleaned.slice(last, m.index);
    if (gap.trim()) throw new MoveParseError(`Unknown move "${gap.trim()}"`);
    tokens.push(m[0]);
    last = m.index + m[0].length;
  }
  const tail = cleaned.slice(last);
  if (tail.trim()) throw new MoveParseError(`Unknown move "${tail.trim()}"`);
  return tokens;
}

/**
 * Parse a sequence into quarter turns [{ face, layers, cw, notation }].
 * A half turn ("F2") becomes two quarter turns ("F F"), so move history and
 * permutation traces compose the right number of turns.
 * Throws MoveParseError on an invalid token.
 */
export function parseMoveSequence(sequence, N = 3, options) {
  return tokenizeSequence(sequence).flatMap(tok => expandToken(parseToken(tok, N, options)));
}

const OPPOSITE_FACE = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
const SLICE_OF = { L: ['M', true], R: ['M', false], D: ['E', true], U: ['E', false], F: ['S', true], B: ['S', false] };
const ROTATION_OF = { R: ['x', true], L: ['x', false], U: ['y', true], D: ['y', false], F: ['z', true], B: ['z', false] };

/**
 * Native notation that parses back to exactly this quarter turn on an N×N
 * cube (a turn made from reduced notation, like "f" on a 4×4, has no
 * single native token for its layers, so this may return several tokens).
 */
export function turnToNotation(turn, N) {
  const layers = [...new Set(turn.layers)].sort((a, b) => a - b);
  const prime = (cw) => (cw ? '' : "'");
  if (layers.length === 0) return '';
  if (layers.length === N) {
    const [rot, same] = ROTATION_OF[turn.face];
    return rot + prime(same ? turn.cw : !turn.cw);
  }
  // Middle slice: the central layer (odd N) or all inner layers (even N)
  const middle = N % 2 ? [(N - 1) / 2] : range(1, N - 1);
  if (N >= 3 && layers.length === middle.length && layers.every((l, i) => l === middle[i])) {
    const [slice, same] = SLICE_OF[turn.face];
    return slice + prime(same ? turn.cw : !turn.cw);
  }
  const contiguousFromOuter = layers.every((l, i) => l === i);
  if (contiguousFromOuter) {
    const depth = layers.length;
    return (depth === 1 ? turn.face : `${depth === 2 ? '' : depth}${turn.face}w`) + prime(turn.cw);
  }
  if (layers.length === 1) return `${layers[0] + 1}${turn.face}${prime(turn.cw)}`;
  // Wide from the opposite side: describe it from that face
  const mirrored = layers.map(l => N - 1 - l).sort((a, b) => a - b);
  if (mirrored.every((l, i) => l === i)) {
    return turnToNotation({ face: OPPOSITE_FACE[turn.face], layers: mirrored, cw: !turn.cw }, N);
  }
  // Anything else: one token per layer (they commute, so the result is the same)
  return layers.map(l => turnToNotation({ ...turn, layers: [l] }, N)).join(' ');
}

/** Apply one quarter turn (all of its layers) */
export function applyTurn(state, turn) {
  return turn.layers.reduce((s, layer) => applyMove(s, turn.face, layer, turn.cw), state);
}

/** Parse and apply a move sequence string, e.g. "R U R' U'" */
export function applyMoveSequence(state, sequence, options) {
  const N = state[0].length;
  return parseMoveSequence(sequence, N, options).reduce(applyTurn, state);
}

/** Apply a single token, including half turns ("F2", "Rw'", "x") */
export function applyNotation(state, token, options) {
  const parsed = parseToken(token, state[0].length, options);
  return expandToken(parsed).reduce(applyTurn, state);
}

/**
 * Check if state is solved
 */
export function isSolved(state) {
  return state.every(face => face.every(row => row.every(c => c === face[0][0])));
}

// Random-move scrambles in the style of WCA scramblers
const SCRAMBLE_SPEC = {
  2: { length: 11, moves: ['R', 'U', 'F'] },
  3: { length: 25, moves: ['R', 'U', 'F', 'D', 'L', 'B'] },
  4: { length: 40, moves: ['R', 'U', 'F', 'D', 'L', 'B', 'Rw', 'Uw', 'Fw'] },
  5: { length: 60, moves: ['R', 'U', 'F', 'D', 'L', 'B', 'Rw', 'Uw', 'Fw', 'Dw', 'Lw', 'Bw'] },
};
const MOVE_AXIS = { R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' };

/**
 * Generate a random-move scramble for an N×N cube.  Never turns the same
 * face (or wide face) twice in a row, and never the same axis three times in
 * a row (R L R), so no move is wasted.
 */
export function randomScramble(N = 3, length) {
  const spec = SCRAMBLE_SPEC[N] ?? SCRAMBLE_SPEC[5];
  const count = length ?? spec.length;
  const suffixes = ['', "'", '2'];
  const result = [];
  let prev = null, prevPrev = null; // [face, axis] of the last two moves
  while (result.length < count) {
    const move = spec.moves[Math.floor(Math.random() * spec.moves.length)];
    const face = move[0];
    const axis = MOVE_AXIS[face];
    if (prev && prev[0] === face) continue;
    if (prev && prevPrev && prev[1] === axis && prevPrev[1] === axis) continue;
    result.push(move + suffixes[Math.floor(Math.random() * 3)]);
    prevPrev = prev;
    prev = [face, axis];
  }
  return result.join(' ');
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

/** 4-cycles of sticker positions moved by one quarter turn (all its layers) */
export function getTurnPositionCycles(turn, N) {
  return turn.layers.flatMap(layer => getMovePositionCycles(turn.face, layer, turn.cw, N));
}

/**
 * Compute the cumulative permutation of a list of quarter turns, starting
 * from the identity.  Returns {perm, cycles, parity}.
 */
export function analyzeSequence(turns, N) {
  const nn = N * N;
  const total = 6 * nn;

  // perm[i] = where the sticker now at position i started
  let perm = Array.from({ length: total }, (_, i) => i);

  for (const turn of turns) {
    const newPerm = [...perm];
    // a→b means the sticker at position a goes to position b
    getTurnPositionCycles(turn, N).forEach(([a, b, c, d]) => {
      newPerm[b] = perm[a];
      newPerm[c] = perm[b];
      newPerm[d] = perm[c];
      newPerm[a] = perm[d];
    });
    perm = newPerm;
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
