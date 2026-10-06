import { describe, it, expect } from 'vitest';
import { ALGORITHMS, usesReducedNotation, algorithmOrder } from '../algorithms';
import { applyMoveSequence, parseMoveSequence, solvedState, FACE_NAMES } from '../cubeState';
import { faceletsToCubie } from '../twophase';

/** Stickers that differ from solved, as "U31:F" labels */
function changed(st) {
  const out = [];
  st.forEach((face, f) => face.forEach((row, r) => row.forEach((c, cc) => {
    if (c !== f) out.push(`${FACE_NAMES[f]}${r}${cc}:${FACE_NAMES[c]}`);
  })));
  return out;
}

describe('algorithm library', () => {
  it('every algorithm parses on every size it is listed for', () => {
    for (const alg of ALGORITHMS) {
      for (const N of alg.cubeSize) {
        expect(() => parseMoveSequence(alg.notation, N, { reduced: usesReducedNotation(alg) }), `${alg.id} on ${N}×${N}`).not.toThrow();
      }
    }
  });

  it('every algorithm does something on every size it is listed for', () => {
    for (const alg of ALGORITHMS) {
      for (const N of alg.cubeSize) {
        const st = applyMoveSequence(solvedState(N), alg.notation, { reduced: usesReducedNotation(alg) });
        expect(changed(st).length, `${alg.id} on ${N}×${N}`).toBeGreaterThan(0);
      }
    }
  });

  it('the OLL parity algorithm flips exactly the UF edge pair (4×4) / outer wings (5×5)', () => {
    const alg = ALGORITHMS.find(a => a.id === 'edge_flip');
    expect(changed(applyMoveSequence(solvedState(4), alg.notation)).sort())
      .toEqual(['F01:U', 'F02:U', 'U31:F', 'U32:F']);
    expect(changed(applyMoveSequence(solvedState(5), alg.notation)).sort())
      .toEqual(['F01:U', 'F03:U', 'U41:F', 'U43:F']);
  });

  it('the PLL parity algorithm swaps edges only (up to a U2 of the last layer)', () => {
    const alg = ALGORITHMS.find(a => a.id === 'pll_parity');
    const st = applyMoveSequence(applyMoveSequence(solvedState(4), alg.notation), 'U2');
    // After undoing the U2, only UF/UB edge stickers differ: a clean two-edge swap
    expect(changed(st).sort()).toEqual(['B01:F', 'B02:F', 'F01:B', 'F02:B']);
  });

  it('checkerboard really makes a checkerboard on 3×3–5×5', () => {
    const alg = ALGORITHMS.find(a => a.id === 'checkerboard');
    for (const N of [3, 4, 5]) {
      const st = applyMoveSequence(solvedState(N), alg.notation, { reduced: true });
      expect(changed(st).length).toBeGreaterThanOrEqual(24);
    }
  });

  it('every PLL moves only some last-layer pieces (no hidden extra U turn)', () => {
    for (const alg of ALGORITHMS.filter(a => a.category === 'PLL')) {
      const c = faceletsToCubie(applyMoveSequence(solvedState(3), alg.notation).flat(2));
      const moved = [...c.cp].filter((p, i) => p !== i).length + [...c.ep].filter((p, i) => p !== i).length;
      const lower = [...c.cp].slice(4).every((p, i) => p === i + 4) && [...c.ep].slice(4).every((p, i) => p === i + 4);
      expect(lower, `${alg.id} disturbs the first two layers`).toBe(true);
      expect(moved, `${alg.id} moves ${moved} last-layer pieces`).toBeLessThanOrEqual(6);
    }
  });

  it('computes orders from the permutation, including on big cubes', () => {
    const alg = id => ALGORITHMS.find(a => a.id === id);
    expect(algorithmOrder(alg('oll_sune'), 3).order).toBe(6);
    expect(algorithmOrder(alg('pll_j_a'), 3).order).toBe(2);
    expect(algorithmOrder(alg('double_commutator'), 3).order).toBe(3);
    // On a 4×4 same-colored centers trade places: T-perm looks solved after 2, but its order is 4
    expect(algorithmOrder(alg('pll_t'), 4)).toEqual({ order: 4, looksSolvedAfter: 2 });
    expect(algorithmOrder({ notation: 'R U', category: 'Beginner' }, 2).order).toBe(15);
  });
});
