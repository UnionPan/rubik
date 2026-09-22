import { describe, it, expect, beforeAll } from 'vitest';
import { applyMoveSequence, solvedState, isSolved, randomScramble } from '../cubeState';
import { solveFacelets, initTables, IllegalCubeError } from '../twophase';

const facelets = (seq) => applyMoveSequence(solvedState(3), seq).flat(2);

describe('two-phase solver', () => {
  beforeAll(() => { initTables(); });

  it('solves random scrambles in at most 30 moves', () => {
    for (let k = 0; k < 40; k++) {
      const st = applyMoveSequence(solvedState(3), randomScramble(3));
      const { moves, phase1Length } = solveFacelets(st.flat(2), { improveMs: 20 });
      expect(moves.length).toBeLessThanOrEqual(30);
      expect(phase1Length).toBeLessThanOrEqual(moves.length);
      expect(isSolved(applyMoveSequence(st, moves.join(' ')))).toBe(true);
    }
  });

  it('phase 2 uses only moves of H = <U, D, R2, L2, F2, B2>', () => {
    const { moves, phase1Length } = solveFacelets(facelets("R U F' L2 D B R' F2 U' L"));
    for (const m of moves.slice(phase1Length)) expect(m).toMatch(/^([UD]['2]?|[RLFB]2)$/);
  });

  it('handles trivial cases', () => {
    expect(solveFacelets(facelets('')).moves).toEqual([]);
    expect(solveFacelets(facelets('R')).moves).toEqual(["R'"]);
  });

  it('rejects impossible cubes with a reason', () => {
    const twisted = facelets('');
    [twisted[8], twisted[9], twisted[20]] = [twisted[9], twisted[20], twisted[8]];
    expect(() => solveFacelets(twisted)).toThrow(IllegalCubeError);
    const swapped = facelets('');
    [swapped[5], swapped[7]] = [swapped[7], swapped[5]];
    [swapped[10], swapped[19]] = [swapped[19], swapped[10]];
    expect(() => solveFacelets(swapped)).toThrow(/parity/);
  });
});
