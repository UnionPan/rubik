/**
 * Algorithm library for NxN Rubik's cubes.
 * Each algorithm has: id, name, category, cubeSize, notation, description,
 * groupTheoryNote, algebraNote (commutator/conjugate form if applicable)
 */
import { analyzeSequence, parseMoveSequence, applyTurn, isSolved, solvedState } from './cubeState';

export const ALGORITHM_CATEGORIES = [
  'Beginner',
  'F2L',
  'OLL',
  'PLL',
  'Big Cube',
  'Patterns',
  'Group Theory',
];

export const ALGORITHMS = [
  // ─── BEGINNER ─────────────────────────────────────────────────────────────
  {
    id: 'sexy_move',
    name: 'Sexy Move',
    category: 'Beginner',
    cubeSize: [2, 3, 4, 5],
    notation: "R U R' U'",
    description:
      'Right side up, top left, right side down, top back. The building block of countless algorithms: six in a row and the cube is solved again.',
    groupTheoryNote:
      'This is the commutator [R, U] = R U R⁻¹ U⁻¹. As an element of the Rubik group G, it has order 6.',
    algebraNote: 'Commutator: [R, U]',
  },
  {
    id: 'sledgehammer',
    name: 'Sledgehammer',
    category: 'Beginner',
    cubeSize: [2, 3, 4, 5],
    notation: "R' F R F'",
    description: 'A four-move trick that pulls a corner and an edge out of the front-right slot together. Often paired with the sexy move.',
    groupTheoryNote: 'This is [R⁻¹, F] = R⁻¹ F R F⁻¹. Also order 6.',
    algebraNote: 'Commutator: [R⁻¹, F]',
  },
  {
    id: 'insert_corner',
    name: 'Corner Insertion (Right)',
    category: 'Beginner',
    cubeSize: [3, 4, 5],
    notation: "U R U' R'",
    description:
      'Drops the corner above the front-right slot into the bottom layer below it.',
    groupTheoryNote: 'U R U⁻¹ R⁻¹ = [U, R] = the sexy move\'s inverse.',
    algebraNote: 'Commutator: [U, R]',
  },
  {
    id: 'insert_edge_left',
    name: 'Edge Insertion (Left)',
    category: 'Beginner',
    cubeSize: [3, 4, 5],
    notation: "U' L' U L U F U' F'",
    description: 'Takes the top-front edge down into the middle layer on the left, keeping the bottom layer intact.',
    groupTheoryNote: null,
    algebraNote: null,
  },

  // ─── F2L ──────────────────────────────────────────────────────────────────
  {
    id: 'f2l_basic_right',
    name: 'F2L Pair (Right)',
    category: 'F2L',
    cubeSize: [3, 4, 5],
    notation: "U R U' R'",
    description:
      'The corner and its edge sit on top, ready to go: this drops both into the front-right slot together.',
    groupTheoryNote:
      'This is [U, R], a 3-generator sequence. The commutator structure preserves the solved bottom layer.',
    algebraNote: '[U, R]',
  },
  {
    id: 'f2l_basic_left',
    name: 'F2L Pair (Left)',
    category: 'F2L',
    cubeSize: [3, 4, 5],
    notation: "U' L' U L",
    description:
      'The mirror image: drops a ready corner-edge pair into the front-left slot.',
    groupTheoryNote: "This is [U', L'] = [U⁻¹, L⁻¹].",
    algebraNote: "[U', L']",
  },
  {
    id: 'f2l_split',
    name: 'F2L Split Pair',
    category: 'F2L',
    cubeSize: [3, 4, 5],
    notation: "R U R' U R U2 R'",
    description:
      'The corner is on top but its edge is stuck in the slot the wrong way: this lifts the edge out and pairs them.',
    groupTheoryNote: null,
    algebraNote: null,
  },

  // ─── OLL ──────────────────────────────────────────────────────────────────
  // Cross-type OLLs (all 4 edges oriented, vary corners)
  {
    id: 'oll_h',
    name: 'H-case (OLL 21)',
    category: 'OLL',
    cubeSize: [2, 3, 4, 5],
    notation: "R U2 R' U' R U R' U' R U' R'",
    description:
      'The top cross is done and all four corners face sideways, in two pairs facing each other.',
    groupTheoryNote:
      'Diagonal corner twists cannot be separated from each other — twisting one corner clockwise forces another counterclockwise. This is why you always fix corners in pairs.',
    algebraNote: 'Cross OLL — 2 diagonal corner twists',
  },
  {
    id: 'oll_pi',
    name: 'Pi-case (OLL 22)',
    category: 'OLL',
    cubeSize: [2, 3, 4, 5],
    notation: "R U2 R2 U' R2 U' R2 U2 R",
    description:
      'The top cross is done and all four corners face sideways: two point the same way, the other two point away from each other.',
    groupTheoryNote:
      'The Pi case is a double Sune composed with a rotation. Its corner-twist pattern has an elegant symmetry: every corner is wrong, but opposite pairs cancel out.',
    algebraNote: 'Cross OLL — all corners twisted',
  },
  {
    id: 'oll_sune',
    name: 'Sune',
    category: 'OLL',
    cubeSize: [2, 3, 4, 5],
    notation: "R U R' U R U2 R'",
    description:
      'The top cross is done and one corner already faces up: the other three twist to face up. The most used last-layer algorithm.',
    groupTheoryNote:
      'Sune is (R U R\' U)(R U2 R\'): it twists three top corners and cycles three top edges while restoring everything below. Six Sunes in a row return the cube to solved, so its order is 6.',
    algebraNote: '(R U R\' U)(R U2 R\') — order 6',
  },
  {
    id: 'oll_antisune',
    name: 'Anti-Sune',
    category: 'OLL',
    cubeSize: [2, 3, 4, 5],
    notation: "R U2 R' U' R U' R'",
    description: 'Sune the other way round: one corner faces up and the other three twist the opposite way.',
    groupTheoryNote: "Anti-Sune is the inverse of Sune in the Rubik group.",
    algebraNote: 'Inverse of Sune',
  },
  {
    id: 'oll_t',
    name: 'OLL T-Shape',
    category: 'OLL',
    cubeSize: [2, 3, 4, 5],
    notation: "F R U R' U' F'",
    description: 'The top shows a T: two corners and a line of edges face up. Turns the rest up in six moves.',
    groupTheoryNote:
      'F [R U R\' U\'] F\' = F · (commutator [R,U]) · F⁻¹ is a conjugation of [R,U] by F.',
    algebraNote: 'Conjugate: F · [R, U] · F⁻¹',
  },
  // L-shape OLLs (2 adjacent edges oriented)
  {
    id: 'oll_37',
    name: 'OLL 37 (Fish)',
    category: 'OLL',
    cubeSize: [2, 3, 4, 5],
    notation: "F R U' R' U' R U R' F'",
    description:
      'Two neighboring edges and two opposite corners face up: a fish shape. Turns the rest up.',
    groupTheoryNote:
      'This is a conjugate: F · [R U\' R\' U\' R U R\'] · F⁻¹. The inner part orients the corner, while F and F⁻¹ redirect which pieces are affected.',
    algebraNote: 'Conjugate: F · (corner sequence) · F⁻¹',
  },
  {
    id: 'oll_33',
    name: 'OLL 33 (T shape)',
    category: 'OLL',
    cubeSize: [2, 3, 4, 5],
    notation: "R U R' U' R' F R F'",
    description:
      'Another T on top, like the T-shape, but the two loose corners point away from each other.',
    groupTheoryNote:
      'R U R\' U\' followed by R\' F R F\' is a product of two commutator-like structures. This is [R, U] · [R\', F].',
    algebraNote: '[R, U] · [R⁻¹, F] (product)',
  },
  // Line OLLs (2 opposite edges oriented)
  {
    id: 'oll_44',
    name: 'OLL 44 (P shape)',
    category: 'OLL',
    cubeSize: [2, 3, 4, 5],
    notation: "F U R U' R' F'",
    description:
      'A P shape on top: a 2×2 block and one more corner face up. One of the shortest cases.',
    groupTheoryNote:
      'F · (U R U\' R\') · F⁻¹ is a conjugate: the inner sequence [U, R] acts on corners, F redirects the effect to the last layer edges.',
    algebraNote: 'Conjugate: F · [U, R] · F⁻¹',
  },
  {
    id: 'oll_dot',
    name: 'OLL Dot (All Edges Flipped)',
    category: 'OLL',
    cubeSize: [3, 4, 5],
    notation: "F R U R' U' F' f R U R' U' f'",
    description: 'No top edge faces up, only the center does. The hardest-looking case, solved with two short sequences back to back.',
    groupTheoryNote: 'Product of two conjugated commutators: F[R,U]F⁻¹ · f[R,U]f⁻¹.',
    algebraNote: 'Product of conjugates',
  },

  // ─── PLL ──────────────────────────────────────────────────────────────────
  {
    id: 'pll_t',
    name: 'T-Perm',
    category: 'PLL',
    cubeSize: [2, 3, 4, 5],
    notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
    description:
      'Swaps two corners on one side and the two edges on the left and right. Shaped like a T.',
    groupTheoryNote:
      'T-perm is a double transposition: it swaps corners UFR↔UBR and edges UL↔UR. Each swap alone is odd; together they are even, and doing it twice is the identity (order 2).',
    algebraNote: 'Order 2 element (double transposition)',
  },
  {
    id: 'pll_u_cw',
    name: 'U-Perm (CW)',
    category: 'PLL',
    cubeSize: [3, 4, 5],
    notation: "R U' R U R U R U' R' U' R2",
    description: 'Moves three top edges around clockwise; the corners stay.',
    groupTheoryNote:
      'U-perm is a 3-cycle in the symmetric group S₄ acting on the corners. It is an even permutation (product of two transpositions), hence lies in A₄.',
    algebraNote: '3-cycle (even permutation)',
  },
  {
    id: 'pll_u_ccw',
    name: 'U-Perm (CCW)',
    category: 'PLL',
    cubeSize: [3, 4, 5],
    notation: "R2 U R U R' U' R' U' R' U R'",
    description: 'Moves three top edges around counter-clockwise; the corners stay.',
    groupTheoryNote: 'Inverse of the CW U-perm. Also a 3-cycle, order 3.',
    algebraNote: '3-cycle inverse',
  },
  {
    id: 'pll_y',
    name: 'Y-Perm',
    category: 'PLL',
    cubeSize: [2, 3, 4, 5],
    notation: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    description:
      'Swaps two diagonal corners and two neighboring edges.',
    groupTheoryNote:
      'Y-perm swaps diagonal corners. Since diagonal corner swaps require an odd permutation of corners, Y-perm cannot be decomposed into pure edge or corner cycles without coupling.',
    algebraNote: 'Diagonal transpositions',
  },

  {
    id: 'pll_j_a',
    name: 'J-Perm A',
    category: 'PLL',
    cubeSize: [2, 3, 4, 5],
    notation: "R' U L' U2 R U' R' U2 R L U'",
    description:
      'Swaps two neighboring corners and the two edges next to them.',
    groupTheoryNote:
      'Two transpositions at once: one of corners, one of edges. Each swap alone is odd, but together they make an even permutation, which is why a legal cube can do it. Doing it twice is the identity: its order is 2.',
    algebraNote: '(corner swap)(edge swap) — even, order 2',
  },
  {
    id: 'pll_r_a',
    name: 'R-Perm A',
    category: 'PLL',
    cubeSize: [2, 3, 4, 5],
    notation: "R U' R' U' R U R D R' U' R D' R' U2 R' U'",
    description:
      'Swaps two neighboring corners and two edges.',
    groupTheoryNote:
      'Like the J-perm, a corner swap paired with an edge swap: two odd transpositions whose product is even. Order 2.',
    algebraNote: '(corner swap)(edge swap) — even, order 2',
  },
  {
    id: 'pll_aa',
    name: 'A-Perm CW (3-corner cycle)',
    category: 'PLL',
    cubeSize: [2, 3, 4, 5],
    notation: "R' F R' B2 R F' R' B2 R2",
    description:
      'Moves three corners around; the edges stay.',
    groupTheoryNote:
      'A-perm is a pure 3-cycle on corners. Since a 3-cycle is an even permutation, it lies in the alternating group A₄ acting on the 4 U-layer corners.',
    algebraNote: 'Pure corner 3-cycle — even permutation, order 3',
  },
  {
    id: 'pll_ab',
    name: 'A-Perm CCW (inverse 3-corner cycle)',
    category: 'PLL',
    cubeSize: [2, 3, 4, 5],
    notation: "R2 B2 R F R' B2 R F' R",
    description:
      'Moves three corners around the other way; the edges stay.',
    groupTheoryNote:
      'Inverse of A-perm CW. Two applications of A-perm CW equal A-perm CCW (since order 3): (A_cw)² = A_ccw.',
    algebraNote: 'Inverse 3-cycle — order 3',
  },

  // ─── BIG CUBE ─────────────────────────────────────────────────────────────
  {
    id: 'edge_flip',
    name: 'OLL Parity (edge flip)',
    category: 'Big Cube',
    cubeSize: [4, 5],
    notation: "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2",
    description:
      'Flips the UF edge pair in place: fixes OLL parity on the 4×4 (one flipped edge after reduction) and the last-edge flip while pairing a 5×5. 2R and 2L are single inner slices.',
    groupTheoryNote:
      'An outer quarter turn moves the wings in two 4-cycles (even); an inner slice quarter turn moves them in one 4-cycle (odd). A single flipped edge means the wing permutation is odd, so no sequence of outer turns can fix it. This algorithm uses 9 inner-slice quarter turns, an odd number.',
    algebraNote: 'sign on the wings = (−1)⁹ = −1',
  },
  {
    id: 'pll_parity',
    name: 'PLL Parity (edge swap)',
    category: 'Big Cube',
    cubeSize: [4],
    notation: "2R2 U2 2R2 Uw2 2R2 Uw2",
    description:
      'Swaps two edge pairs on the top layer (followed by U2): fixes PLL parity on the 4×4, where the last layer cannot be solved by any 3×3 PLL.',
    groupTheoryNote:
      'On a 3×3 the corner and edge permutations always have the same parity. After reducing a 4×4, the edge pairs can have the opposite parity to the corners, because identical-looking center pieces can hide an odd permutation. A 3×3 PLL cannot fix that; this algorithm changes the edge-pair parity while leaving the corners alone.',
    algebraNote: 'sign(edges) ≠ sign(corners) → fix with a hidden center swap',
  },
  {
    id: 'dedge_cycle',
    name: 'Edge Pairing (slice–flip–slice)',
    category: 'Big Cube',
    cubeSize: [4, 5],
    notation: "Uw R U R' Uw'",
    description:
      'The basic edge-pairing move: Uw lines up two matching wings, R U R\' swaps the new pair out for an unpaired edge, and Uw\' restores the centers.',
    groupTheoryNote:
      'A conjugate: Uw · (R U R\') · Uw⁻¹. The setup Uw moves the inner slice so R U R\' acts on a different set of wings; undoing the setup keeps the centers solved.',
    algebraNote: 'Conjugate: Uw · (R U R\') · Uw⁻¹',
  },

  // ─── PATTERNS ─────────────────────────────────────────────────────────────
  {
    id: 'checkerboard',
    name: 'Checkerboard',
    category: 'Patterns',
    cubeSize: [3, 4, 5],
    notation: "M2 E2 S2",
    description:
      'Every face becomes a checkerboard of its own color and the opposite one.',
    groupTheoryNote:
      'M², E², S² are all order-2 elements (they equal their own inverses). Their product generates the checkerboard: an element of order 2 in the center of the Rubik group\'s abelianization.',
    algebraNote: 'Product of order-2 elements',
  },
  {
    id: 'superflip',
    name: 'Superflip',
    category: 'Patterns',
    cubeSize: [3],
    notation: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    description:
      'Every edge flipped in place, everything else solved. It is one of the hardest positions there is: no solution is shorter than 20 moves.',
    groupTheoryNote:
      'The superflip flips all 12 edges in place and moves nothing else. It is in the center of the whole cube group: it commutes with every move. Edge flips must sum to an even number, so the edge-flip subgroup is ℤ₂¹¹. In 1995 the superflip was the first position proven to need 20 moves.',
    algebraNote: 'Central element; lies in the edge-flip subgroup ℤ₂¹¹',
  },
  {
    id: 'six_spot',
    name: 'Six-Spot',
    category: 'Patterns',
    cubeSize: [3],
    notation: "U D' R L' F B' U D'",
    description:
      'Gives every face an outer ring in another color around its own center: six contrasting spots.',
    groupTheoryNote:
      'Each pair U D\', R L\', F B\' turns opposite faces in opposite directions. Relative to the centers, that is a middle-slice turn combined with a whole-cube rotation, so the pattern is really built from slice moves. Its order is 3.',
    algebraNote: null,
  },

  // ─── GROUP THEORY DEMOS ───────────────────────────────────────────────────
  {
    id: 'commutator_demo',
    name: 'Pure Commutator Demo',
    category: 'Group Theory',
    cubeSize: [3, 4, 5],
    notation: "R U R' U'",
    description:
      'R U R\' U\' again, as an idea: do two moves, undo them in the same order, and only the pieces both moves touch end up changed.',
    groupTheoryNote:
      'A commutator [A, B] = A B A⁻¹ B⁻¹ measures how much A and B fail to commute. For the Rubik group, commutators of face moves are typically 3-cycles or double-transpositions — the building blocks of all solving algorithms.',
    algebraNote: '[R, U] = R U R⁻¹ U⁻¹',
    refs: [
      { label: 'Janet Chen: Group Theory and the Rubik\'s Cube', url: null },
      { label: 'Singmaster notation (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Rubik%27s_cube#Move_notation' },
    ],
  },
  {
    id: 'conjugate_demo',
    name: 'Conjugation Demo',
    category: 'Group Theory',
    cubeSize: [3, 4, 5],
    notation: "F R U R' U' F'",
    description:
      'F, then the sexy move, then F back: the same shuffle as the sexy move, carried to different pieces by the setup move F.',
    groupTheoryNote:
      'Conjugation: A B A⁻¹ "transports" the action of B to a new position. If B = [R, U] affects front-right corner, then F B F⁻¹ affects whichever corner F moved there. This is the group-theoretic basis of the "setup move + algorithm + undo setup" technique.',
    algebraNote: 'Conjugate: F · [R, U] · F⁻¹',
    refs: [
      { label: 'Janet Chen, §4: Conjugates', url: null },
      { label: 'Dummit & Foote, Abstract Algebra §3.3', url: null },
    ],
  },
  {
    id: 'double_commutator',
    name: 'Niklas (Pure Corner 3-Cycle)',
    category: 'Group Theory',
    cubeSize: [3, 4, 5],
    notation: "R U' L' U R' U' L U",
    description:
      'Cycles three corners and touches nothing else. Repeat it three times and the cube is back where it started.',
    groupTheoryNote:
      'The Niklas is a commutator [R, U\' L\' U] whose second element is itself a conjugate: U\' L\' U is L\' moved to a different place. Commutators of moves that overlap in a single piece produce exactly this kind of small, pure 3-cycle; every 3-cycle is even, and 3-cycles generate the commutator subgroup of the cube group.',
    algebraNote: '[R, U\' L\' U] — commutator with a conjugate',
  },
];

/** Get algorithms applicable to a given cube size */
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/**
 * Order of an algorithm as a group element on an N×N cube, computed from its
 * sticker permutation (lcm of the cycle lengths), and how many repetitions
 * it takes until the cube merely *looks* solved again (identical stickers on
 * big cubes can trade places, so that can come sooner).
 */
export function algorithmOrder(alg, N) {
  const turns = parseMoveSequence(alg.notation, N, { reduced: usesReducedNotation(alg) });
  const order = analyzeSequence(turns, N).cycles.reduce((o, c) => (o / gcd(o, c.length)) * c.length, 1);
  let st = solvedState(N);
  let looksSolvedAfter = order;
  for (let k = 1; k < order; k++) {
    st = turns.reduce(applyTurn, st);
    if (isSolved(st)) { looksSolvedAfter = k; break; }
  }
  return { order, looksSolvedAfter };
}

/**
 * 3×3 algorithms are written in 3×3 notation; on a big cube they run through
 * the reduction map (outer layers stay outer, the 3×3 middle slice becomes all
 * inner slices).  Big-cube algorithms use native N×N notation (Rw = 2 layers).
 */
export function usesReducedNotation(alg) {
  return alg.category !== 'Big Cube';
}

export function getAlgorithmsForSize(N) {
  return ALGORITHMS.filter(a => a.cubeSize.includes(N));
}

/** Get algorithms by category */
export function getAlgorithmsByCategory(category) {
  return ALGORITHMS.filter(a => a.category === category);
}

/** Get algorithm by id */
export function getAlgorithm(id) {
  return ALGORITHMS.find(a => a.id === id);
}

/** Parse algorithm notation into individual move tokens */
export function tokenize(notation) {
  if (!notation) return [];
  return notation.trim().split(/\s+/).filter(Boolean);
}
