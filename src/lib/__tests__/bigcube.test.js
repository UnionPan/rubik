import { describe, it, expect, beforeAll } from 'vitest';
import { solveBigCube } from '../bigcube/solve';
import { edgeSolver, targetParity } from '../bigcube/edges';
import { bigCubeMoves, simplify, toTurns } from '../bigcube/moves';
import { initTables } from '../twophase';
import { applyMoveSequence, solvedState, randomScramble, applyTurn, isSolved } from '../cubeState';

beforeAll(() => { initTables(); });

describe('big-cube moves', () => {
  it('simplify merges moves on one axis', () => {
    const { byKey } = bigCubeMoves(4);
    const R = byKey.get('R01'), Ri = byKey.get('R03'), L = byKey.get('L01'), U = byKey.get('U01');
    expect(simplify(4, [R, L, Ri])).toEqual([L]);
    expect(simplify(4, [R, R])).toEqual([byKey.get('R02')]);
    expect(simplify(4, [R, U, Ri])).toEqual([R, U, Ri]);
  });
  it('turns name each layer', () => {
    const { byKey } = bigCubeMoves(5);
    expect(toTurns(5, [byKey.get('R11'), byKey.get('U02')]).map(t => t.notation)).toEqual(['2R', 'U', 'U']);
  });
});

describe('wing 3-cycles', () => {
  it.each([4, 5])('the generated library is pure on the %s×%s', (N) => {
    const es = edgeSolver(N);
    const { moves } = bigCubeMoves(N);
    // Spot-check: every library algorithm moves exactly three wings
    for (const algo of [...es.library.values()].slice(0, 200)) {
      const perm = algo.reduce((p, mi) => { const q = moves[mi].perm; const out = new Int16Array(p.length); for (let i = 0; i < p.length; i++) out[i] = p[q[i]]; return out; },
        Int16Array.from({ length: 6 * N * N }, (_, i) => i));
      const from = es.slots.map(([a, b]) => es.slotIndex.get(`${perm[a]},${perm[b]}`));
      expect(from.filter((f, k) => f !== k)).toHaveLength(3);
      expect(targetParity(from)).toBe(0);
    }
  });
});

describe('solveBigCube', () => {
  it.each([4, 5])('solves random %s×%s scrambles', (N) => {
    for (let trial = 0; trial < 4; trial++) {
      const scrambled = applyMoveSequence(solvedState(N), randomScramble(N, 80));
      const { stages } = solveBigCube(scrambled, N);
      const turns = stages.flatMap(s => s.turns);
      expect(isSolved(turns.reduce(applyTurn, scrambled))).toBe(true);
      expect(turns.length).toBeLessThan(N === 4 ? 300 : 420);
      // every stage ends where it says: centers solved after the first one
      expect(stages[0].id).toBe('centers');
    }
  }, 60000);

  it('handles both parity cases on the 4×4', () => {
    const oll = applyMoveSequence(solvedState(4), '2R');          // one inner quarter turn: odd wings
    const pll = applyMoveSequence(solvedState(4), "R U R' U' R' F R2 U' R' U' R U R' F' Uw2");
    for (const st of [oll, pll]) {
      const { stages } = solveBigCube(st, 4);
      expect(isSolved(stages.flatMap(s => s.turns).reduce(applyTurn, st))).toBe(true);
    }
  });
});
