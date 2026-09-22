import { describe, it, expect } from 'vitest';
import {
  solvedState, applyMoveSequence, applyTurn, isSolved, parseMoveSequence, parseToken,
  tokenizeSequence, turnToNotation, randomScramble, analyzeSequence, getMovePositionCycles,
  MoveParseError,
} from '../cubeState';

const layersOf = (seq, N, opts) => parseMoveSequence(seq, N, opts).map(t => `${t.face}${t.layers.join('')}${t.cw ? '' : "'"}`);
const inverse = (turns) => [...turns].reverse().map(t => ({ ...t, cw: !t.cw }));

describe('notation', () => {
  it('parses outer, inner, wide, slice and rotation moves on a 4×4', () => {
    expect(layersOf("R U2 Rw' 3Rw 2R r f' M2 E S' x y' z2", 4)).toEqual([
      'R0', 'U0', 'U0', "R01'", 'R012', 'R1', 'R01', "F01'", 'L12', 'L12', 'D12', "F12'",
      'R0123', "U0123'", 'F0123', 'F0123',
    ]);
  });

  it('uses the central slice on odd cubes', () => {
    expect(layersOf('M E S', 5)).toEqual(['L2', 'D2', 'F2']);
  });

  it('maps 3×3 notation onto big cubes in reduced mode', () => {
    expect(layersOf('f M2', 4, { reduced: true })).toEqual(['F012', 'L12', 'L12']);
    expect(layersOf('f', 3, { reduced: true })).toEqual(['F01']);
  });

  it('expands half turns into two quarter turns labelled as quarter turns', () => {
    expect(parseMoveSequence("U2 Rw2'", 4).map(t => t.notation)).toEqual(['U', 'U', "Rw'", "Rw'"]);
  });

  it('tolerates missing spaces and brackets', () => {
    expect(tokenizeSequence("(RUR'U') x2")).toEqual(['R', 'U', "R'", "U'", 'x2']);
  });

  it('rejects unknown and impossible moves with a clear message', () => {
    expect(() => parseMoveSequence('R Q U', 3)).toThrow('Unknown move "Q"');
    expect(() => parseToken('4R', 3)).toThrow(MoveParseError);
    expect(() => parseToken('M', 2)).toThrow('inner layers');
  });

  it('writes any turn back as native notation that replays identically', () => {
    for (const N of [2, 3, 4, 5]) {
      for (const [seq, opts] of [["f M2 x' r E S' y z2", { reduced: true }], ["Rw' Lw M x y' Fw2 E", {}]]) {
        let turns;
        try { turns = parseMoveSequence(seq, N, opts); } catch { continue; }
        for (const t of turns) {
          const replay = parseMoveSequence(turnToNotation(t, N), N).reduce(applyTurn, solvedState(N));
          expect(replay).toEqual(applyTurn(solvedState(N), t));
        }
      }
    }
  });
});

describe('moves', () => {
  it('whole-cube rotations keep the cube looking solved and have order 4', () => {
    for (const N of [2, 3, 4, 5]) {
      expect(isSolved(applyMoveSequence(solvedState(N), 'x y2 z'))).toBe(true);
      const turns = parseMoveSequence('x x x x', N);
      expect(analyzeSequence(turns, N).cycles).toHaveLength(0);
    }
  });

  it('every turn followed by its inverse is the identity', () => {
    for (const N of [2, 3, 4, 5]) {
      const turns = parseMoveSequence(randomScramble(N), N);
      const back = [...turns, ...inverse(turns)].reduce(applyTurn, solvedState(N));
      expect(isSolved(back)).toBe(true);
    }
  });

  it('a 3×3 face turn is five 4-cycles of stickers', () => {
    expect(getMovePositionCycles('R', 0, true, 3)).toHaveLength(5);
    expect(analyzeSequence(parseMoveSequence('R', 3), 3).parity).toBe('odd');
  });
});

describe('scrambles', () => {
  const lengths = { 2: 11, 3: 25, 4: 40, 5: 60 };
  it.each([2, 3, 4, 5])('%i×%i scrambles have WCA-style length and no wasted moves', (N) => {
    for (let k = 0; k < 20; k++) {
      const toks = randomScramble(N).split(' ');
      expect(toks).toHaveLength(lengths[N]);
      const faces = toks.map(t => t[0]);
      const axis = f => ({ R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' })[f];
      for (let i = 1; i < faces.length; i++) {
        expect(faces[i]).not.toBe(faces[i - 1]);
        if (i >= 2) expect(axis(faces[i]) === axis(faces[i - 1]) && axis(faces[i]) === axis(faces[i - 2])).toBe(false);
      }
      expect(() => parseMoveSequence(toks.join(' '), N)).not.toThrow();
    }
  });

  it('2×2 scrambles only use R, U and F', () => {
    expect(randomScramble(2).replace(/['2\s]/g, '')).toMatch(/^[RUF]+$/);
  });
});
