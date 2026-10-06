/**
 * Algorithms for the geometry-engine puzzles.  Each one is the shortest
 * sequence (found by searching the whole group) that has the stated
 * `effect` on a solved puzzle; the tests check every effect by simulation.
 */
export const GENERIC_CATEGORIES = {
  ivy: ['Basics', 'Leaves', 'Corners'],
  diamond: ['Basics', 'Corners', 'Centers'],
};

export const GENERIC_ALGORITHMS = {
  ivy: [
    {
      id: 'ivy_turn', name: 'One turn', category: 'Basics', notation: 'F',
      effect: { 'corner-twisted': 1, 'leaf-moved': 3 },
      description: 'Twists one corner in place and cycles the three leaves around it.',
      groupTheoryNote: 'A generator of the Ivy Cube group: an element of order 3.',
    },
    {
      id: 'ivy_leaf_cycle', name: 'Leaf 3-cycle', category: 'Leaves', notation: "F U F' U'",
      effect: { 'leaf-moved': 3 },
      description: 'Cycles three leaves and leaves both corners as they were.',
      groupTheoryNote: 'The commutator [F, U]. F and U share one leaf, so all the change happens around it, and the corner twists cancel.',
      algebraNote: '[F, U]',
    },
    {
      id: 'ivy_leaf_swaps', name: 'Leaf double swap', category: 'Leaves', notation: "L' U L F U' F'",
      effect: { 'leaf-moved': 4 },
      description: 'Swaps two pairs of leaves. Leaves always make an even permutation, so a single swap is impossible.',
      groupTheoryNote: 'Every Ivy turn is a 3-cycle of leaves, which is even, so only even permutations of the leaves are reachable: a double swap, never a single one.',
    },
    {
      id: 'ivy_corner_twist', name: 'Single corner twist', category: 'Corners', notation: "U F R U R' U' F'",
      effect: { 'corner-twisted': 1 },
      description: 'Twists one corner and restores every leaf.',
      groupTheoryNote: 'Corner twists are independent on the Ivy Cube (unlike a Rubik\'s cube), so one corner can be twisted alone.',
    },
    {
      id: 'ivy_corner_pair', name: 'Two-corner twist', category: 'Corners', notation: "R L R' F U F'",
      effect: { 'corner-twisted': 2 },
      description: 'Twists two corners and restores every leaf.',
    },
  ],
  diamond: [
    {
      id: 'dia_turn', name: 'One turn', category: 'Basics', notation: 'F',
      effect: { 'corner-moved': 3, 'free-moved': 3 },
      description: 'Turns half the puzzle: three corners and three free centers cycle, the fixed center spins in place.',
      groupTheoryNote: 'A generator of the Skewb Diamond group: an element of order 3.',
    },
    {
      id: 'dia_commutator', name: 'Commutator', category: 'Basics', notation: "F U F' U'",
      effect: { 'corner-moved': 3, 'free-moved': 4 },
      description: 'The commutator of two turns: only the pieces both turns touch change.',
      algebraNote: '[F, U]',
    },
    {
      id: 'dia_corner_cycle', name: 'Corner 3-cycle', category: 'Corners', notation: "F U F U' F' U'",
      effect: { 'corner-moved': 3 },
      description: 'Cycles three corners and restores every center.',
    },
    {
      id: 'dia_corner_flips', name: 'Corner flip pair', category: 'Corners', notation: "R' F' R' U' R' U' F' U' F'",
      effect: { 'corner-twisted': 2 },
      description: 'Flips two corners in place. Corners only ever flip in pairs.',
      groupTheoryNote: 'A corner has two orientations, and every turn flips an even number of them, so a single flipped corner is unreachable.',
    },
    {
      id: 'dia_center_cycle', name: 'Center 3-cycle', category: 'Centers', notation: "R F R F' R F R F'",
      effect: { 'free-moved': 3 },
      description: 'Cycles three free centers and restores every corner.',
      groupTheoryNote: 'The square of R F R F\': the corners it moves come back after two repetitions, while the centers still end up cycled.',
      algebraNote: "(R F R F')²",
    },
  ],
};
