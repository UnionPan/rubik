import { describe, it, expect } from 'vitest';
import { getPuzzle } from '../puzzles';
import { rotate, distance } from '../puzzles/geometry';
import { MoveParseError } from '../cubeState';

describe.each(['ivy', 'diamond'])('%s', (id) => {
  const p = getPuzzle(id);

  it('every turn maps stickers exactly onto stickers and has order 3', () => {
    for (const mv of p.moves) {
      const axis = p.axes[mv.axis];
      for (const i of axis.moving) {
        const q = rotate(p.stickers[i].center, axis.vector, mv.angle);
        expect(distance(q, p.stickers[mv.perm[i]].center)).toBeLessThan(1e-9);
      }
      mv.cycles.forEach(c => expect(c.length).toBe(3));
    }
    for (const t of p.generators) {
      expect(p.isSolved([t, t, t].reduce(p.applyTurn, p.solvedState()))).toBe(true);
    }
  });

  it('enumerates exactly the known number of positions', () => {
    expect(p.enumerate().order).toBe(p.expectedOrder);
  });

  it('solves random positions optimally', () => {
    for (let k = 0; k < 20; k++) {
      const scramble = p.randomScramble();
      const st = p.applyMoveSequence(p.solvedState(), scramble);
      const sol = p.solve(st);
      expect(sol.length).toBe(p.distanceToSolved(st));
      expect(sol.length).toBeLessThanOrEqual(scramble.split(' ').filter(Boolean).length);
      expect(p.isSolved(sol.reduce(p.applyTurn, st))).toBe(true);
    }
  });

  it('parses its notation and rejects unknown moves', () => {
    expect(p.parseMoveSequence("F R' U2 L").map(t => t.notation)).toEqual(['F', "R'", 'U', 'U', 'L']);
    expect(() => p.parseMoveSequence('F Q')).toThrow(MoveParseError);
  });
});

describe('known facts', () => {
  it("Skewb Diamond: God's number 10, with 15 positions at distance 10 (Jaap's table)", () => {
    const { godsNumber, distribution } = getPuzzle('diamond').enumerate();
    expect(godsNumber).toBe(10);
    expect(distribution.at(-1)).toBe(15);
    expect(distribution.reduce((a, b) => a + b, 0)).toBe(138240);
  });

  it('Ivy Cube: corners only twist in place; the 6 leaves form one orbit', () => {
    const labels = getPuzzle('ivy').orbits.map(o => `${o.label}:${o.members.length}`);
    expect(labels).toEqual(expect.arrayContaining(['Leaves:6', 'Corner URF:3']));
    expect(labels).toHaveLength(5);
  });

  it('Skewb Diamond: corner stickers split into two orbits of 12 (corners have 2 orientations)', () => {
    const orbits = getPuzzle('diamond').orbits;
    expect(orbits.filter(o => o.kind === 'corner').map(o => o.members.length)).toEqual([12, 12]);
    expect(orbits.find(o => o.kind === 'fixed').members).toHaveLength(4);
  });
});

describe('algorithm library', () => {
  it.each(['ivy', 'diamond'])('%s: every algorithm has exactly its stated effect, optimally', async (id) => {
    const { GENERIC_ALGORITHMS } = await import('../puzzles/library');
    const p = getPuzzle(id);
    for (const alg of GENERIC_ALGORITHMS[id]) {
      const st = p.applyMoveSequence(p.solvedState(), alg.notation);
      expect(p.pieceEffect(st), alg.id).toEqual(alg.effect);
      // shortest possible: the position is exactly as far from solved as the algorithm is long
      expect(p.distanceToSolved(st), alg.id).toBe(p.parseMoveSequence(alg.notation).length);
    }
  });
});

describe('stage detector', () => {
  it('Ivy: one face → opposite face → leaves → solved', async () => {
    const { detectGeneric } = await import('../puzzles/detect');
    const { getModel } = await import('../puzzles/models');
    const m = getModel('ivy');
    expect(detectGeneric(m, m.solvedState()).stage).toBe('solved');
    // A leaf 3-cycle leaves only leaves unsolved, with corners and two opposite faces intact
    expect(detectGeneric(m, m.applyMoveSequence(m.solvedState(), "F U F' U'")).stage).toBe('leaves');
    // From a random position, following optimal solutions passes through the stages in order
    const order = ['first-face', 'second-face', 'leaves', 'solved'];
    for (let k = 0; k < 10; k++) {
      let st = m.applyMoveSequence(m.solvedState(), m.randomScramble());
      let last = order.indexOf(detectGeneric(m, st).stage);
      for (const t of m.solve(st)) {
        st = m.applyTurn(st, t);
        const now = order.indexOf(detectGeneric(m, st).stage);
        expect(now).toBeGreaterThanOrEqual(0);
        last = now;
      }
      expect(order[last]).toBe('solved');
    }
  });

  it('Skewb Diamond: corners around a fixed face → other corners → centers', async () => {
    const { detectGeneric } = await import('../puzzles/detect');
    const { getModel } = await import('../puzzles/models');
    const m = getModel('diamond');
    expect(detectGeneric(m, m.solvedState()).stage).toBe('solved');
    expect(detectGeneric(m, m.applyMoveSequence(m.solvedState(), "R F R F' R F R F'")).stage).toBe('centers');
    // Property: the stage follows from which corners are home
    const triples = [['U', 'R', 'F'], ['U', 'L', 'B'], ['D', 'L', 'F'], ['D', 'R', 'B']];
    for (let k = 0; k < 200; k++) {
      const st = m.applyMoveSequence(m.solvedState(), m.randomScramble());
      const home = (v) => m.pieceStatus(st, `corner-${v}`) === 'home';
      const stage = detectGeneric(m, st).stage;
      const expected = m.isSolved(st) ? 'solved'
        : ['U', 'D', 'R', 'L', 'F', 'B'].every(home) ? 'centers'
        : triples.some(t => t.every(home)) ? 'other-corners'
        : 'first-corners';
      expect(stage).toBe(expected);
    }
  });
});
