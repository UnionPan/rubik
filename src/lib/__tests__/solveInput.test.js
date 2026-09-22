import { describe, it, expect, beforeAll } from 'vitest';
import { applyMoveSequence, applyTurn, parseMoveSequence, solvedState, isSolved, randomScramble } from '../cubeState';
import { ALGORITHMS } from '../algorithms';
import { initTables, solveFacelets } from '../twophase';
import { buildSolveInput } from '../solveInput';

const outerScramble = (n) => Array.from({ length: n }, () =>
  'RUFDLB'[Math.floor(Math.random() * 6)] + ['', "'", '2'][Math.floor(Math.random() * 3)]).join(' ');
const inverse = (N, notation) => parseMoveSequence(notation, N).reverse().map(t => ({ ...t, cw: !t.cw }));

/** Solve through the full pipeline and check the real cube ends solved */
function solveAndCheck(state, N) {
  const input = buildSolveInput(state, N);
  expect(input.ok, input.reason).toBe(true);
  const { moves } = solveFacelets(input.facelets, { improveMs: 10 });
  let st = state;
  for (const p of input.prefix) st = applyMoveSequence(st, p.notation);
  st = applyMoveSequence(st, moves.join(' '));
  expect(isSolved(st)).toBe(true);
  return input;
}

describe('solve pipeline for every size', () => {
  beforeAll(() => { initTables(); });

  it('2×2: corners on a virtual 3×3, including odd corner permutations', () => {
    for (let k = 0; k < 20; k++) solveAndCheck(applyMoveSequence(solvedState(2), outerScramble(15)), 2);
    solveAndCheck(applyMoveSequence(solvedState(2), 'R'), 2); // a single quarter turn: odd permutation
  });

  it('3×3: from any orientation, after rotations and slice moves', () => {
    for (let k = 0; k < 10; k++) {
      solveAndCheck(applyMoveSequence(solvedState(3), `${randomScramble(3)} x M' y2 S E2 z'`), 3);
    }
  });

  it('4×4: reduced positions in all four parity combinations', () => {
    const flip = ALGORITHMS.find(a => a.id === 'edge_flip').notation;
    const swap = ALGORITHMS.find(a => a.id === 'pll_parity').notation;
    const labels = [];
    for (let k = 0; k < 4; k++) {
      let st = solvedState(4);
      if (k & 1) st = inverse(4, flip).reduce(applyTurn, st);
      if (k & 2) st = inverse(4, swap).reduce(applyTurn, st);
      st = applyMoveSequence(st, outerScramble(25));
      labels.push(solveAndCheck(st, 4).prefix.map(p => p.label).join('+'));
    }
    expect(labels).toEqual(['', 'OLL parity', 'PLL parity', 'OLL parity+PLL parity']);
  });

  it('5×5: reduced positions never need a parity fix', () => {
    for (let k = 0; k < 5; k++) {
      expect(solveAndCheck(applyMoveSequence(solvedState(5), outerScramble(25)), 5).prefix).toEqual([]);
    }
  });

  it('asks for reduction first on a scrambled big cube', () => {
    const input = buildSolveInput(applyMoveSequence(solvedState(4), randomScramble(4)), 4);
    expect(input.ok).toBe(false);
    expect(input.reason).toMatch(/centers/);
  });
});
