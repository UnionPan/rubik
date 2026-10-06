/**
 * One interface over every puzzle on the site.  Cubes wrap the tested N×N
 * engine (cubeState, faceletGraph); other puzzles come from the geometry
 * engine.  A model provides:
 *   id, kind ('cube' | 'generic'), label, name, stickerCount, groupOrder
 *   solvedState(), applyTurn(state, turn), isSolved(state)
 *   parseMoveSequence(seq), turnToNotation(turn), turnCycles(turn)
 *   graph (facelet-graph model), faceNames, colors, slotFace(i), slotLabel(i)
 * Cube models also have N; generic models have axes and the engine extras.
 */
import {
  solvedState, applyTurn, isSolved, parseMoveSequence, turnToNotation,
  randomScramble, getTurnPositionCycles, FACE_NAMES,
} from '../cubeState';
import { cubeGraphModel } from '../faceletGraph';
import { getPuzzle } from './index';

export const PUZZLES = [
  { id: 'cube2', label: '2×2', name: '2×2 Pocket' },
  { id: 'cube3', label: '3×3', name: '3×3 Classic' },
  { id: 'cube4', label: '4×4', name: '4×4 Revenge' },
  { id: 'cube5', label: '5×5', name: '5×5 Professor' },
  { id: 'ivy', label: 'Ivy', name: 'Ivy Cube' },
  { id: 'diamond', label: 'Diamond', name: 'Skewb Diamond' },
];

const CUBE_ORDERS = { 2: '3,674,160', 3: '4.3 × 10¹⁹', 4: '7.4 × 10⁴⁵', 5: '2.8 × 10⁷⁴' };
const CUBE_COLORS = ['#FFFFFF', '#B71234', '#009B48', '#FFD500', '#FF5800', '#0046AD'];
const cache = new Map();

function cubeModel(meta, N) {
  const nn = N * N;
  return {
    ...meta, kind: 'cube', N,
    stickerCount: 6 * nn,
    groupOrder: CUBE_ORDERS[N],
    faceNames: FACE_NAMES,
    colors: CUBE_COLORS,
    solvedState: () => solvedState(N),
    applyTurn,
    isSolved,
    parseMoveSequence: (seq) => parseMoveSequence(seq, N),
    turnToNotation: (t) => turnToNotation(t, N),
    turnCycles: (t) => getTurnPositionCycles(t, N),
    randomScramble: () => randomScramble(N),
    slotFace: (i) => Math.floor(i / nn),
    slotLabel: (i) => `${FACE_NAMES[Math.floor(i / nn)]}${Math.floor((i % nn) / N)}${i % N}`,
    graph: cubeGraphModel(N),
  };
}

function genericModel(meta) {
  const p = getPuzzle(meta.id);
  const perFace = {};
  const slotIndexOnFace = p.stickers.map(s => { perFace[s.face] = (perFace[s.face] || 0) + 1; return perFace[s.face] - 1; });
  return {
    ...p, ...meta, kind: 'generic',
    groupOrder: p.expectedOrder.toLocaleString('en-US'),
    slotFace: (i) => p.stickers[i].face,
    slotLabel: (i) => `${p.faceNames[p.stickers[i].face]}${slotIndexOnFace[i]}`,
  };
}

export function getModel(id) {
  if (!cache.has(id)) {
    const meta = PUZZLES.find(x => x.id === id) ?? PUZZLES[1];
    cache.set(meta.id, meta.id.startsWith('cube') ? cubeModel(meta, Number(meta.id.slice(4))) : genericModel(meta));
  }
  return cache.get(id);
}

export const isPuzzleId = (id) => PUZZLES.some(p => p.id === id);
