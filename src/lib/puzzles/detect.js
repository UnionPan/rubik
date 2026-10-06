/**
 * Stage detector for the geometry-engine puzzles, following each puzzle's
 * common beginner method:
 *
 *   Ivy Cube       one face → the opposite face → the four remaining leaves
 *                  (two opposite faces contain all four turning corners)
 *   Skewb Diamond  the three corners around one fixed face → the other three
 *                  corners → the four free centers   (after Jaap Scherphuis)
 *
 * The exact number of moves left comes separately, from the enumerated group.
 * Returns the same shape as the cube detector (patternRecognition.js).
 */

import { COLORS } from '../cubeState';

const OPPOSITE_FACE = [3, 4, 5, 0, 1, 2]; // cube face order U R F D L B
const DIAMOND_FIXED = { F: ['U', 'R', 'F'], U: ['U', 'L', 'B'], L: ['D', 'L', 'F'], R: ['D', 'R', 'B'] };

function steps(ids, labels, currentId) {
  const idx = ids.indexOf(currentId);
  return ids.map((id, i) => ({
    id, label: labels[i],
    status: currentId === 'solved' || i < idx ? 'done' : i === idx ? 'current' : 'todo',
  }));
}

function result(fields) {
  return { matchedAlg: null, matchKind: null, setup: '', finish: '', edgeInfo: null, progress: null, notes: [], ...fields };
}

function detectIvy(model, state) {
  const ids = ['first-face', 'second-face', 'leaves'];
  const labels = ['One face', 'Opposite face', 'Leaves'];
  const mk = (stage, stageLabel, fields) => result({ method: 'Layer by layer', stage, stageLabel, steps: steps(ids, labels, stage), ...fields });
  const color = (f) => COLORS[f].name; // the Ivy uses the cube's color scheme
  // stickers on each face that already show that face's color
  const correct = model.faceNames.map((_, f) =>
    model.stickers.filter((s, i) => s.face === f && state[i] === f).length);
  const total = model.stickers.filter(s => s.face === 0).length;
  const solvedFaces = correct.map((c, f) => (c === total ? f : -1)).filter(f => f >= 0);

  if (solvedFaces.length === model.faceNames.length) {
    return mk('solved', 'Solved', { message: 'Solved. Scramble it and try the method: one face, the opposite face, then the leaves.' });
  }
  if (solvedFaces.length === 0) {
    const best = Math.max(...correct);
    const f = correct.indexOf(best);
    return mk('first-face', 'One face', {
      message: `Build one face: both corners and the leaf in one color. The ${color(f)} face is closest.`,
      progress: { done: best, total, unit: `on ${color(f)}` },
    });
  }
  // Two opposite faces hold all four turning corners: once every corner is
  // twisted correctly, only the leaves are left.
  const cornersDone = Object.keys(model.pieceSlots)
    .filter(p => p.startsWith('corner-'))
    .every(p => model.pieceStatus(state, p) === 'home');
  if (!cornersDone) {
    const pair = solvedFaces[0];
    const opp = OPPOSITE_FACE[pair];
    return mk('second-face', 'Opposite face', {
      message: `The ${color(pair)} face is done. Now build the opposite ${color(opp)} face without breaking it.`,
      progress: { done: correct[opp], total, unit: `on ${color(opp)}` },
      notes: ['Two opposite faces hold all four turning corners, so after this step only leaves are left.'],
    });
  }
  const leavesHome = model.stickers.filter((s, i) => s.kind === 'leaf' && state[i] === s.face).length;
  return mk('leaves', 'Leaves', {
    message: 'All corners are done. Cycle the remaining leaves into place, e.g. with the leaf 3-cycle F U F\' U\'.',
    progress: { done: leavesHome, total: 6, unit: 'leaves' },
    matchedAlg: { id: 'ivy_leaf_cycle', name: 'Leaf 3-cycle', notation: "F U F' U'" },
    matchKind: 'suggested',
  });
}

function detectDiamond(model, state) {
  const ids = ['first-corners', 'other-corners', 'centers'];
  const labels = ['3 corners', 'Other corners', 'Centers'];
  const mk = (stage, stageLabel, fields) => result({ method: 'Corners first', stage, stageLabel, steps: steps(ids, labels, stage), ...fields });
  const cornerHome = (v) => model.pieceStatus(state, `corner-${v}`) === 'home';
  const all = ['U', 'D', 'R', 'L', 'F', 'B'];

  if (model.isSolved(state)) {
    return mk('solved', 'Solved', { message: 'Solved. Scramble it and try the method: corners around one fixed face, the other corners, then the centers.' });
  }
  // The fixed face whose three corners are most complete
  const options = Object.entries(DIAMOND_FIXED).map(([axis, vs]) => ({ axis, vs, done: vs.filter(cornerHome).length }));
  options.sort((a, b) => b.done - a.done);
  const best = options[0];
  if (best.done < 3) {
    return mk('first-corners', '3 corners', {
      message: `Solve the three corners around one fixed face: around ${best.axis} that is ${best.vs.join(', ')}.`,
      progress: { done: best.done, total: 3, unit: 'corners' },
    });
  }
  const rest = all.filter(v => !best.vs.includes(v));
  const restDone = rest.filter(cornerHome).length;
  if (restDone < 3) {
    return mk('other-corners', 'Other corners', {
      message: `Corners ${best.vs.join(', ')} are done. Now place and orient ${rest.join(', ')}.`,
      progress: { done: restDone, total: 3, unit: 'corners' },
      matchedAlg: { id: 'dia_corner_cycle', name: 'Corner 3-cycle', notation: "F U F U' F' U'" },
      matchKind: 'suggested',
    });
  }
  const freeHome = model.stickers.filter((s, i) => s.kind === 'free' && state[i] === s.face).length;
  return mk('centers', 'Centers', {
    message: 'All corners are done. Cycle the four free centers into place.',
    progress: { done: freeHome, total: 4, unit: 'centers' },
    matchedAlg: { id: 'dia_center_cycle', name: 'Center 3-cycle', notation: "R F R F' R F R F'" },
    matchKind: 'suggested',
  });
}

export function detectGeneric(model, state) {
  if (model.id === 'ivy') return detectIvy(model, state);
  if (model.id === 'diamond') return detectDiamond(model, state);
  return null;
}
