/**
 * Algorithm library for NxN Rubik's cubes.
 * Each algorithm has: id, name, category, cubeSize, notation, description,
 * groupTheoryNote, algebraNote (commutator/conjugate form if applicable)
 */

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
      'The most fundamental Rubik\'s cube algorithm. Repeated 6 times returns to solved. Moves a corner from front-right-top.',
    groupTheoryNote:
      'This is the commutator [R, U] = R U R⁻¹ U⁻¹. As an element of the Rubik group G, it has order 6.',
    algebraNote: 'Commutator: [R, U]',
    order: 6,
  },
  {
    id: 'sledgehammer',
    name: 'Sledgehammer',
    category: 'Beginner',
    cubeSize: [2, 3, 4, 5],
    notation: "R' F R F'",
    description: 'Inverse of the Sune-related setup. Used in many beginner approaches for corners.',
    groupTheoryNote: 'This is [R⁻¹, F] = R⁻¹ F R F⁻¹. Also order 6.',
    algebraNote: 'Commutator: [R⁻¹, F]',
    order: 6,
  },
  {
    id: 'insert_corner',
    name: 'Corner Insertion (Right)',
    category: 'Beginner',
    cubeSize: [3, 4, 5],
    notation: "U R U' R'",
    description:
      'Inserts a corner from the top layer into the front-right slot. Inverse of the sexy move.',
    groupTheoryNote: 'U R U⁻¹ R⁻¹ = [U, R] = the sexy move\'s inverse.',
    algebraNote: 'Commutator: [U, R]',
    order: 6,
  },
  {
    id: 'insert_edge_left',
    name: 'Edge Insertion (Left)',
    category: 'Beginner',
    cubeSize: [3, 4, 5],
    notation: "U' L' U L U F U' F'",
    description: 'Inserts an edge from the top layer into the front-left slot.',
    groupTheoryNote: null,
    algebraNote: null,
    order: null,
  },

  // ─── F2L ──────────────────────────────────────────────────────────────────
  {
    id: 'f2l_basic_right',
    name: 'F2L Pair (Right)',
    category: 'F2L',
    cubeSize: [3, 4, 5],
    notation: "U R U' R'",
    description:
      'Inserts a corner-edge pair into the right-front slot when both pieces are on the top layer.',
    groupTheoryNote:
      'This is [U, R], a 3-generator sequence. The commutator structure preserves the solved bottom layer.',
    algebraNote: '[U, R]',
    order: 6,
  },
  {
    id: 'f2l_basic_left',
    name: 'F2L Pair (Left)',
    category: 'F2L',
    cubeSize: [3, 4, 5],
    notation: "U' L' U L",
    description:
      'Inserts a corner-edge pair into the left-front slot.',
    groupTheoryNote: "This is [U', L'] = [U⁻¹, L⁻¹].",
    algebraNote: "[U', L']",
    order: 6,
  },
  {
    id: 'f2l_split',
    name: 'F2L Split Pair',
    category: 'F2L',
    cubeSize: [3, 4, 5],
    notation: "R U R' U R U2 R'",
    description:
      'Handles F2L case where corner and edge are split (corner on top, edge in slot wrong).',
    groupTheoryNote: null,
    algebraNote: null,
    order: null,
  },

  // ─── OLL ──────────────────────────────────────────────────────────────────
  // Cross-type OLLs (all 4 edges oriented, vary corners)
  {
    id: 'oll_h',
    name: 'H-case (OLL 21)',
    category: 'OLL',
    cubeSize: [3, 4, 5],
    notation: "R U2 R' U' R U R' U' R U' R'",
    description:
      'OLL #21. All edges oriented, 2 diagonal corners twisted. One of the 7 cross OLL cases.',
    groupTheoryNote:
      'Diagonal corner twists cannot be separated from each other — twisting one corner clockwise forces another counterclockwise. This is why you always fix corners in pairs.',
    algebraNote: 'Cross OLL — 2 diagonal corner twists',
    order: null,
  },
  {
    id: 'oll_pi',
    name: 'Pi-case (OLL 22)',
    category: 'OLL',
    cubeSize: [3, 4, 5],
    notation: "R U2 R2 U' R2 U' R2 U2 R",
    description:
      'OLL #22. All edges oriented, 4 corners twisted (looks like the letter π). Symmetric case.',
    groupTheoryNote:
      'The Pi case is a double Sune composed with a rotation. Its corner-twist pattern has an elegant symmetry: every corner is wrong, but opposite pairs cancel out.',
    algebraNote: 'Cross OLL — all corners twisted',
    order: null,
  },
  {
    id: 'oll_sune',
    name: 'Sune',
    category: 'OLL',
    cubeSize: [3, 4, 5],
    notation: "R U R' U R U2 R'",
    description:
      'OLL #27. Orients 3 corners of the last layer. One of the most important last-layer algorithms.',
    groupTheoryNote:
      'Sune can be written as R (U R\' U)² R⁻¹ U R\' which reveals its conjugate structure. It has order 7 when applied to the full cube but solves OLL in 1 application for the Sune case.',
    algebraNote: 'Conjugate form visible: R [U R\' U R U² R\'] R⁻¹ effectively',
    order: null,
  },
  {
    id: 'oll_antisune',
    name: 'Anti-Sune',
    category: 'OLL',
    cubeSize: [3, 4, 5],
    notation: "R U2 R' U' R U' R'",
    description: 'OLL #26. Inverse orientation of Sune. Orients 3 corners in the opposite cycle.',
    groupTheoryNote: "Anti-Sune is the inverse of Sune in the Rubik group.",
    algebraNote: 'Inverse of Sune',
    order: null,
  },
  {
    id: 'oll_t',
    name: 'OLL T-Shape',
    category: 'OLL',
    cubeSize: [3, 4, 5],
    notation: "F R U R' U' F'",
    description: 'OLL #45. Orients edges in a T-pattern. The "inverse" of the standard edge flip.',
    groupTheoryNote:
      'F [R U R\' U\'] F\' = F · (commutator [R,U]) · F⁻¹ is a conjugation of [R,U] by F.',
    algebraNote: 'Conjugate: F · [R, U] · F⁻¹',
    order: null,
  },
  // L-shape OLLs (2 adjacent edges oriented)
  {
    id: 'oll_37',
    name: 'OLL 37 (Hockey Stick)',
    category: 'OLL',
    cubeSize: [3, 4, 5],
    notation: "F R U' R' U' R U R' F'",
    description:
      'OLL #37. Two adjacent edges oriented (L-shape), one corner twisted. Looks like a hockey stick on the U face.',
    groupTheoryNote:
      'This is a conjugate: F · [R U\' R\' U\' R U R\'] · F⁻¹. The inner part orients the corner, while F and F⁻¹ redirect which pieces are affected.',
    algebraNote: 'Conjugate: F · (corner sequence) · F⁻¹',
    order: null,
  },
  {
    id: 'oll_33',
    name: 'OLL 33 (P shape)',
    category: 'OLL',
    cubeSize: [3, 4, 5],
    notation: "R U R' U' R' F R F'",
    description:
      'OLL #33. Two adjacent edges oriented. Extremely common in practice; often used as a sub-case.',
    groupTheoryNote:
      'R U R\' U\' followed by R\' F R F\' is a product of two commutator-like structures. This is [R, U] · [R\', F].',
    algebraNote: '[R, U] · [R⁻¹, F] (product)',
    order: null,
  },
  // Line OLLs (2 opposite edges oriented)
  {
    id: 'oll_44',
    name: 'OLL 44 (Line L)',
    category: 'OLL',
    cubeSize: [3, 4, 5],
    notation: "F U R U' R' F'",
    description:
      'OLL #44. Two opposite edges oriented (line), with specific corner orientations. One of the shortest OLL algorithms.',
    groupTheoryNote:
      'F · (U R U\' R\') · F⁻¹ is a conjugate: the inner sequence [U, R] acts on corners, F redirects the effect to the last layer edges.',
    algebraNote: 'Conjugate: F · [U, R] · F⁻¹',
    order: null,
  },
  {
    id: 'oll_dot',
    name: 'OLL Dot (All Edges Flipped)',
    category: 'OLL',
    cubeSize: [3, 4, 5],
    notation: "F R U R' U' F' f R U R' U' f'",
    description: 'OLL when no edges are oriented (dot case). Uses two conjugated commutators.',
    groupTheoryNote: 'Product of two conjugated commutators: F[R,U]F⁻¹ · f[R,U]f⁻¹.',
    algebraNote: 'Product of conjugates',
    order: null,
  },

  // ─── PLL ──────────────────────────────────────────────────────────────────
  {
    id: 'pll_t',
    name: 'T-Perm',
    category: 'PLL',
    cubeSize: [3, 4, 5],
    notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
    description:
      'PLL T-permutation. Swaps two adjacent corners and two adjacent edges on the last layer.',
    groupTheoryNote:
      'T-perm is a double transposition: swaps corners UFR↔UBR and edges UF↔UR. As an element of the PLL subgroup (≅ A₄ × ℤ₃₂ / ...), it has order 2.',
    algebraNote: 'Order 2 element (double transposition)',
    order: 2,
  },
  {
    id: 'pll_u_cw',
    name: 'U-Perm (CW)',
    category: 'PLL',
    cubeSize: [3, 4, 5],
    notation: "R U' R U R U R U' R' U' R2",
    description: 'Cycles three edges clockwise on the last layer.',
    groupTheoryNote:
      'U-perm is a 3-cycle in the symmetric group S₄ acting on the corners. It is an even permutation (product of two transpositions), hence lies in A₄.',
    algebraNote: '3-cycle (even permutation)',
    order: 3,
  },
  {
    id: 'pll_u_ccw',
    name: 'U-Perm (CCW)',
    category: 'PLL',
    cubeSize: [3, 4, 5],
    notation: "R2 U R U R' U' R' U' R' U R'",
    description: 'Cycles three edges counter-clockwise on the last layer.',
    groupTheoryNote: 'Inverse of the CW U-perm. Also a 3-cycle, order 3.',
    algebraNote: '3-cycle inverse',
    order: 3,
  },
  {
    id: 'pll_y',
    name: 'Y-Perm',
    category: 'PLL',
    cubeSize: [3, 4, 5],
    notation: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    description:
      'Swaps two diagonal corners and two adjacent edges. One of the only PLL algorithms involving diagonal swaps.',
    groupTheoryNote:
      'Y-perm swaps diagonal corners. Since diagonal corner swaps require an odd permutation of corners, Y-perm cannot be decomposed into pure edge or corner cycles without coupling.',
    algebraNote: 'Diagonal transpositions',
    order: 2,
  },

  {
    id: 'pll_j_a',
    name: 'J-Perm A',
    category: 'PLL',
    cubeSize: [3, 4, 5],
    notation: "R' U L' U2 R U' R' U2 R L",
    description:
      'Swaps two adjacent corners and two adjacent edges (in different positions from T-perm). One of the J-perm variants.',
    groupTheoryNote:
      'J-perm A is a (2,2)-type permutation: two transpositions that together form an even permutation. Its order is 2.',
    algebraNote: 'Even permutation — order 2',
    order: 2,
  },
  {
    id: 'pll_r_a',
    name: 'R-Perm A (3-corner cycle)',
    category: 'PLL',
    cubeSize: [3, 4, 5],
    notation: "R U' R' U' R U R D R' U' R D' R' U2 R'",
    description:
      'Cycles three corners clockwise while permuting adjacent edges. One of the most asymmetric PLLs.',
    groupTheoryNote:
      'R-perm A is a 3-cycle on corners coupled with edge moves. As an element of the PLL subgroup (which is isomorphic to a subgroup of S₄ × S₄ factoring out orientation), it has order 3.',
    algebraNote: '3-cycle + edge coupling, order 3',
    order: 3,
  },
  {
    id: 'pll_aa',
    name: 'A-Perm CW (3-corner cycle)',
    category: 'PLL',
    cubeSize: [3, 4, 5],
    notation: "R' F R' B2 R F' R' B2 R2",
    description:
      'Cycles three corners clockwise on the last layer with no edge movement.',
    groupTheoryNote:
      'A-perm is a pure 3-cycle on corners. Since a 3-cycle is an even permutation, it lies in the alternating group A₄ acting on the 4 U-layer corners.',
    algebraNote: 'Pure corner 3-cycle — even permutation, order 3',
    order: 3,
  },
  {
    id: 'pll_ab',
    name: 'A-Perm CCW (inverse 3-corner cycle)',
    category: 'PLL',
    cubeSize: [3, 4, 5],
    notation: "R2 B2 R F R' B2 R F' R",
    description:
      'Inverse of A-Perm CW. Cycles three corners counter-clockwise.',
    groupTheoryNote:
      'Inverse of A-perm CW. Two applications of A-perm CW equal A-perm CCW (since order 3): (A_cw)² = A_ccw.',
    algebraNote: 'Inverse 3-cycle — order 3',
    order: 3,
  },

  // ─── BIG CUBE ─────────────────────────────────────────────────────────────
  {
    id: 'edge_flip',
    name: 'OLL Parity (4x4/5x5)',
    category: 'Big Cube',
    cubeSize: [4, 5],
    notation: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
    description:
      'Fixes OLL parity on 4x4: a single edge piece oriented incorrectly — impossible on 3x3.',
    groupTheoryNote:
      'On a 4x4 cube, the parity group is ℤ₂ × ℤ₂ (OLL parity × PLL parity). A single edge flip corresponds to a generator of the ℤ₂ OLL parity subgroup, invisible on 3x3.',
    algebraNote: 'Parity subgroup: ℤ₂ × ℤ₂',
    order: 2,
  },
  {
    id: 'pll_parity',
    name: 'PLL Parity (4x4/5x5)',
    category: 'Big Cube',
    cubeSize: [4, 5],
    notation: "2R2 U2 2R2 Uw2 2R2 Uw2",
    description:
      'Fixes PLL parity on 4x4: a single edge swap — again impossible on 3x3 by the even-permutation constraint.',
    groupTheoryNote:
      'PLL parity arises because the 4x4 cube group is larger than the 3x3 group: the group quotient includes ℤ₂ parity subgroups for inner-layer edge pairs.',
    algebraNote: 'Parity group element',
    order: 2,
  },
  {
    id: 'dedge_cycle',
    name: '3-Edge Dedge Cycle',
    category: 'Big Cube',
    cubeSize: [4, 5],
    notation: "Uw R U R' Uw'",
    description:
      'Cycles three dedge (double-edge) pairs during the reduction phase of 4x4/5x5 solving.',
    groupTheoryNote:
      'This is a conjugate: Uw · [R, U] · Uw⁻¹, localizing the commutator\'s effect to the upper layers.',
    algebraNote: 'Conjugate: Uw · [R,U] · Uw⁻¹',
    order: null,
  },

  // ─── PATTERNS ─────────────────────────────────────────────────────────────
  {
    id: 'checkerboard',
    name: 'Checkerboard',
    category: 'Patterns',
    cubeSize: [2, 3, 4, 5],
    notation: "M2 E2 S2",
    description:
      'Creates a checkerboard pattern on all 6 faces. Each center color swaps with its opposite.',
    groupTheoryNote:
      'M², E², S² are all order-2 elements (they equal their own inverses). Their product generates the checkerboard: an element of order 2 in the center of the Rubik group\'s abelianization.',
    algebraNote: 'Product of order-2 elements',
    order: 2,
  },
  {
    id: 'superflip',
    name: 'Superflip',
    category: 'Patterns',
    cubeSize: [3],
    notation: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    description:
      'All 12 edges flipped in place, corners unchanged. The furthest position from solved: requires exactly 20 moves (God\'s Number proof).',
    groupTheoryNote:
      'The superflip is the unique element of the Rubik group that flips all 12 edges without moving any piece. It lies in the center of the edge-flip subgroup (ℤ₂¹²). The God\'s Number proof showed no position requires more than 20 moves.',
    algebraNote: 'Element of edge orientation subgroup ℤ₂¹²',
    order: 2,
  },
  {
    id: 'six_spot',
    name: 'Six-Spot',
    category: 'Patterns',
    cubeSize: [3],
    notation: "U D' R L' F B' U D'",
    description:
      'Places each face\'s center color on the opposite face\'s center, creating 6 contrasting spots.',
    groupTheoryNote:
      'Six-spot is a product of opposite-face center transpositions. Centers form a subgroup isomorphic to ℤ₃ × ℤ₃ (rotations only) on the 3x3.',
    algebraNote: null,
    order: 6,
  },

  // ─── GROUP THEORY DEMOS ───────────────────────────────────────────────────
  {
    id: 'commutator_demo',
    name: 'Pure Commutator Demo',
    category: 'Group Theory',
    cubeSize: [3, 4, 5],
    notation: "R U R' U'",
    description:
      'The simplest commutator [R, U]. Demonstrates how commutators perform 3-cycles of corners when repeated, a foundational technique in group-theoretic cube solving.',
    groupTheoryNote:
      'A commutator [A, B] = A B A⁻¹ B⁻¹ measures how much A and B fail to commute. For the Rubik group, commutators of face moves are typically 3-cycles or double-transpositions — the building blocks of all solving algorithms.',
    algebraNote: '[R, U] = R U R⁻¹ U⁻¹',
    order: 6,
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
      'A conjugate F · [R,U] · F⁻¹. Shows how conjugating a commutator by F translates its effect to different pieces, a key technique for OLL/PLL.',
    groupTheoryNote:
      'Conjugation: A B A⁻¹ "transports" the action of B to a new position. If B = [R, U] affects front-right corner, then F B F⁻¹ affects whichever corner F moved there. This is the group-theoretic basis of the "setup move + algorithm + undo setup" technique.',
    algebraNote: 'Conjugate: F · [R, U] · F⁻¹',
    order: null,
    refs: [
      { label: 'Janet Chen, §4: Conjugates', url: null },
      { label: 'Dummit & Foote, Abstract Algebra §3.3', url: null },
    ],
  },
  {
    id: 'double_commutator',
    name: 'Double Commutator (Pure 3-Cycle)',
    category: 'Group Theory',
    cubeSize: [3, 4, 5],
    notation: "R U2 R' U' R U2 L' U R' U' L",
    description:
      'A pure 3-cycle of corners with no edge disturbance. Constructed as a double commutator [[R,U²],L].',
    groupTheoryNote:
      'Double commutators [[A,B],C] are powerful because they are even more localized than single commutators. For the 3x3 group, any pure corner 3-cycle can be expressed as a double commutator. This is related to the fact that the commutator subgroup [G,G] contains all 3-cycles (since 3-cycles are even permutations).',
    algebraNote: '[[R, U²], L] — a double commutator',
    order: 3,
    refs: [
      { label: 'Janet Chen: Commutator subgroups', url: null },
      { label: 'Herstein: Abstract Algebra', url: null },
    ],
  },
];

/** Get algorithms applicable to a given cube size */
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
