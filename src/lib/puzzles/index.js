import { buildPuzzle } from './engine';
import { ivy } from './ivy';
import { diamond } from './diamond';

const DEFINITIONS = { ivy, diamond };
const cache = new Map();

/** The built puzzle model for a generic (non-cube) puzzle id, cached */
export function getPuzzle(id) {
  if (!cache.has(id)) cache.set(id, buildPuzzle(DEFINITIONS[id]));
  return cache.get(id);
}

export const GENERIC_PUZZLES = Object.values(DEFINITIONS).map(d => ({ id: d.id, name: d.name, shortName: d.shortName }));
