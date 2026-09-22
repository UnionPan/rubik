import { describe, it, expect } from 'vitest';
import { applyMoveSequence, applyTurn, parseMoveSequence, solvedState, randomScramble } from '../cubeState';
import { ALGORITHMS, usesReducedNotation } from '../algorithms';
import { detectPattern, reduceTo3x3, cubeInvariants } from '../patternRecognition';

const alg = id => ALGORITHMS.find(a => a.id === id);
const inverseOf = (N, a) => parseMoveSequence(a.notation, N, { reduced: usesReducedNotation(a) })
  .reverse().map(t => ({ ...t, cw: !t.cw }));
/** Solved cube, then `pre`, then the inverse of an algorithm: that algorithm's case */
const caseOf = (N, id, pre = '') => inverseOf(N, alg(id)).reduce(applyTurn, applyMoveSequence(solvedState(N), pre));

/** Apply the detector's suggestion (setup → algorithm → finish) */
function followSuggestion(st, d) {
  let s = applyMoveSequence(st, d.setup || '');
  s = applyMoveSequence(s, d.matchedAlg.notation, { reduced: usesReducedNotation(d.matchedAlg) });
  return applyMoveSequence(s, d.finish || '');
}

describe('3×3 (CFOP)', () => {
  it('reports solved, cross, F2L stages with progress', () => {
    expect(detectPattern(solvedState(3), 3).stage).toBe('solved');
    expect(detectPattern(applyMoveSequence(solvedState(3), "R U F' L2 D B' R2 U'"), 3).stage).toBe('cross');
    const f2l = detectPattern(applyMoveSequence(solvedState(3), "R U R'"), 3);
    expect(f2l.stage).toBe('f2l');
    expect(f2l.progress).toMatchObject({ done: 3, total: 4 });
  });

  it('follows the centers after a whole-cube rotation', () => {
    expect(detectPattern(applyMoveSequence(solvedState(3), "x2 R U R'"), 3).stage).toBe('f2l');
  });

  it.each(['oll_sune', 'oll_antisune', 'oll_h', 'oll_pi', 'oll_t', 'oll_33', 'oll_37', 'oll_44', 'oll_dot'])(
    'recognizes %s and its suggestion orients the last layer', (id) => {
      const st = caseOf(3, id);
      const d = detectPattern(st, 3);
      expect(d.stage).toBe('oll');
      expect(d.matchedAlg).toBeTruthy();
      expect(['pll', 'solved']).toContain(detectPattern(followSuggestion(st, d), 3).stage);
    });

  it.each(['pll_t', 'pll_u_cw', 'pll_u_ccw', 'pll_y', 'pll_j_a', 'pll_r_a', 'pll_aa', 'pll_ab'])(
    'recognizes %s (with AUF) and its suggestion solves the cube', (id) => {
      const st = caseOf(3, id, 'U');
      const d = detectPattern(st, 3);
      expect(d.stage).toBe('pll');
      expect(detectPattern(followSuggestion(st, d), 3).stage).toBe('solved');
    });

  it('never reports a parity violation on reachable 3×3 states', () => {
    for (let k = 0; k < 100; k++) {
      const inv = cubeInvariants(reduceTo3x3(applyMoveSequence(solvedState(3), randomScramble(3))));
      expect(inv.flipSum % 2).toBe(0);
      expect(inv.cornerParity).toBe(inv.edgeParity);
    }
  });
});

describe('2×2 (layer by layer)', () => {
  it('detects the first layer, OLL and PLL', () => {
    expect(detectPattern(applyMoveSequence(solvedState(2), "R U2 F' R' U F2"), 2).stage).toBe('first-layer');
    const oll = caseOf(2, 'oll_sune');
    const d = detectPattern(oll, 2);
    expect(d.stage).toBe('oll');
    expect(detectPattern(followSuggestion(oll, d), 2).stage).toBe('solved');
    const pll = caseOf(2, 'pll_y', 'U2');
    const d2 = detectPattern(pll, 2);
    expect(d2.stage).toBe('pll');
    expect(detectPattern(followSuggestion(pll, d2), 2).stage).toBe('solved');
  });
});

describe('4×4 and 5×5 (reduction)', () => {
  it('tracks centers and edge pairing', () => {
    expect(detectPattern(applyMoveSequence(solvedState(4), '2R'), 4).stage).toBe('centers');
    const edges = detectPattern(applyMoveSequence(solvedState(4), "Uw R U R' Uw'"), 4);
    expect(edges.stage).toBe('edges');
    expect(edges.matchKind).toBe('suggested');
  });

  it('rejects mirrored centers', () => {
    const st = solvedState(4).map(f => f.map(r => [...r]));
    for (const r of [1, 2]) for (const c of [1, 2]) [st[1][r][c], st[4][r][c]] = [st[4][r][c], st[1][r][c]];
    expect(detectPattern(st, 4).message).toMatch(/wrong arrangement/);
  });

  it('detects OLL parity, warns early, and its fix works', () => {
    const st = caseOf(4, 'edge_flip');
    const d = detectPattern(st, 4);
    expect(d.stage).toBe('oll-parity');
    expect(d.matchedAlg.id).toBe('edge_flip');
    expect(detectPattern(followSuggestion(st, d), 4).stage).toBe('solved');
    const early = detectPattern(applyMoveSequence(st, "R U R'"), 4);
    expect(early.stage).toBe('f2l');
    expect(early.notes.join(' ')).toMatch(/OLL parity/);
  });

  it('detects PLL parity and its fix works', () => {
    const st = caseOf(4, 'pll_parity');
    const d = detectPattern(st, 4);
    expect(d.stage).toBe('pll-parity');
    expect(detectPattern(followSuggestion(st, d), 4).stage).toBe('solved');
  });

  it('runs 3×3 last-layer algorithms through the reduction map', () => {
    for (const [N, id, stage] of [[4, 'oll_dot', 'oll'], [4, 'pll_t', 'pll'], [5, 'oll_sune', 'oll'], [5, 'pll_t', 'pll']]) {
      const st = caseOf(N, id);
      const d = detectPattern(st, N);
      expect(d.stage).toBe(stage);
      expect(['pll', 'solved']).toContain(detectPattern(followSuggestion(st, d), N).stage);
    }
  });

  it('spots the 5×5 last-edge flip', () => {
    const d = detectPattern(applyMoveSequence(solvedState(5), alg('edge_flip').notation), 5);
    expect(d.stage).toBe('edges');
    expect(d.progress.done).toBe(11);
  });
});
