/**
 * Algorithm library for the current puzzle, in one shape for the Algorithms tab:
 *   categories, defaultCategory, list (for this puzzle), find(id),
 *   resolveToken(alg, token) → turns, label
 */
import {
  ALGORITHMS, ALGORITHM_CATEGORIES, getAlgorithmsForSize, usesReducedNotation,
} from './algorithms';
import { parseToken, expandToken } from './cubeState';
import { GENERIC_ALGORITHMS, GENERIC_CATEGORIES } from './puzzles/library';

const cache = new Map();

export function getLibrary(model) {
  if (cache.has(model.id)) return cache.get(model.id);
  let lib;
  if (model.kind === 'cube') {
    const N = model.N;
    lib = {
      label: `${N}×${N}`,
      categories: ALGORITHM_CATEGORIES,
      defaultCategory: 'Beginner',
      list: getAlgorithmsForSize(N),
      find: (id) => ALGORITHMS.find(a => a.id === id),
      // 3×3 algorithms run on big cubes through the reduction map
      resolveToken: (alg, tok) => expandToken(parseToken(tok, N, { reduced: usesReducedNotation(alg) })),
      note: N > 3
        ? '3×3 algorithms run on the reduced cube: outer turns stay outer, and the 3×3 middle slice becomes all inner slices (M, E, S and wide turns).'
        : null,
    };
  } else {
    const list = GENERIC_ALGORITHMS[model.id];
    lib = {
      label: model.name,
      categories: GENERIC_CATEGORIES[model.id],
      defaultCategory: GENERIC_CATEGORIES[model.id][0],
      list,
      find: (id) => list.find(a => a.id === id),
      resolveToken: (alg, tok) => model.parseMoveSequence(tok),
      note: 'Each algorithm is the shortest possible sequence for its effect, found by searching every position of the puzzle.',
    };
  }
  cache.set(model.id, lib);
  return lib;
}
