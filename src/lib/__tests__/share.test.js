import { describe, it, expect } from 'vitest';
import { getModel } from '../puzzles/models';
import { encodeShareHash, decodeShareHash } from '../share';

describe('share links', () => {
  it.each(['cube2', 'cube3', 'cube4', 'cube5', 'ivy', 'diamond'])('round-trips a %s position exactly', (id) => {
    const model = getModel(id);
    const scramble = model.kind === 'cube' ? model.randomScramble() : "F U' L R F'";
    const moves = model.kind === 'cube'
      ? model.parseMoveSequence(model.N >= 3 ? "R U' x M Rw" : "R U' x")
      : model.parseMoveSequence("R L' U2");
    const decoded = decodeShareHash(encodeShareHash({ model, scramble, moves }));
    const replay = (s, m) => [...s, ...m].reduce(model.applyTurn, model.solvedState());
    expect(decoded.puzzleId).toBe(id);
    expect(decoded.scramble).toBe(scramble);
    expect(replay(decoded.scrambleTurns, decoded.moves)).toEqual(replay(model.parseMoveSequence(scramble), moves));
  });

  it('keeps the pristine default URL clean and is readable', () => {
    expect(encodeShareHash({ model: getModel('cube3') })).toBe('');
    const cube4 = getModel('cube4');
    expect(encodeShareHash({ model: cube4, scramble: "R U2 Fw'", moves: cube4.parseMoveSequence('M') })).toBe("#n=4&s=R_U2_Fw'&m=M");
    const ivy = getModel('ivy');
    expect(encodeShareHash({ model: ivy, moves: ivy.parseMoveSequence("F U'") })).toBe("#p=ivy&m=F_U'");
  });

  it('ignores invalid links', () => {
    expect(decodeShareHash('')).toBeNull();
    expect(decodeShareHash('#n=9&s=R')).toBeNull();
    expect(decodeShareHash('#n=3&s=Q')).toBeNull();
    expect(decodeShareHash('#p=megaminx')).toBeNull();
    expect(decodeShareHash('#p=ivy&m=M')).toBeNull();
  });
});
