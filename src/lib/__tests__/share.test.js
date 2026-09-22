import { describe, it, expect } from 'vitest';
import { applyTurn, parseMoveSequence, randomScramble, solvedState } from '../cubeState';
import { encodeShareHash, decodeShareHash } from '../share';

describe('share links', () => {
  it.each([2, 3, 4, 5])('round-trips a %i×%i position exactly', (N) => {
    const scramble = randomScramble(N);
    const moves = parseMoveSequence(N >= 3 ? "R U' x M f2" : "R U' x", N, { reduced: true });
    const decoded = decodeShareHash(encodeShareHash({ N, scramble, moves }));
    const replay = (s, m) => [...s, ...m].reduce(applyTurn, solvedState(N));
    expect(decoded.N).toBe(N);
    expect(decoded.scramble).toBe(scramble);
    expect(replay(decoded.scrambleTurns, decoded.moves)).toEqual(replay(parseMoveSequence(scramble, N), moves));
  });

  it('keeps the pristine default URL clean and is readable', () => {
    expect(encodeShareHash({ N: 3, scramble: '', moves: [] })).toBe('');
    expect(encodeShareHash({ N: 4, scramble: "R U2 Fw'", moves: parseMoveSequence('M', 4) })).toBe("#n=4&s=R_U2_Fw'&m=M");
  });

  it('ignores invalid links', () => {
    expect(decodeShareHash('')).toBeNull();
    expect(decodeShareHash('#n=9&s=R')).toBeNull();
    expect(decodeShareHash('#n=3&s=Q')).toBeNull();
  });
});
