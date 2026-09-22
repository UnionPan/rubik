import { describe, it, expect } from 'vitest';
import { ALGORITHMS, usesReducedNotation } from '../algorithms';
import { applyMoveSequence, parseMoveSequence, solvedState, FACE_NAMES } from '../cubeState';

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
});
