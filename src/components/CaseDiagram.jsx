import { useMemo } from 'react';
import { parseMoveSequence, applyTurn, solvedState, COLORS } from '../lib/cubeState';

/**
 * CaseDiagram - the last-layer case an algorithm solves, seen from above
 * (front at the bottom), as on a cuber's algorithm sheet.  The case is the
 * algorithm's inverse applied to a solved 3×3, so the picture is always the
 * one the algorithm really solves.
 *
 *   mode 'oll'  top-color stickers lit, the rest gray: which way pieces face
 *   mode 'pll'  every sticker in color, arrows where the pieces will go
 */

const U = 0, R = 1, F = 2, L = 4, B = 5;
const TOP = '#F5F0E8';
const GRAY = '#3a3420';

// Last-layer slots: [face, row, col] of each sticker, U sticker first
const SLOTS = [
  { at: [0, 0], stickers: [[U, 0, 0], [B, 0, 2], [L, 0, 0]] },
  { at: [0, 2], stickers: [[U, 0, 2], [B, 0, 0], [R, 0, 2]] },
  { at: [2, 2], stickers: [[U, 2, 2], [F, 0, 2], [R, 0, 0]] },
  { at: [2, 0], stickers: [[U, 2, 0], [F, 0, 0], [L, 0, 2]] },
  { at: [0, 1], stickers: [[U, 0, 1], [B, 0, 1]] },
  { at: [1, 2], stickers: [[U, 1, 2], [R, 0, 1]] },
  { at: [2, 1], stickers: [[U, 2, 1], [F, 0, 1]] },
  { at: [1, 0], stickers: [[U, 1, 0], [L, 0, 1]] },
];

const CELL = 12, GAP = 1.5, STRIP = 5;
const O = STRIP + 2 * GAP;          // top-left corner of the U face
const SIZE = 2 * O + 3 * CELL + 2 * GAP;
const cellXY = (r, c) => [O + c * (CELL + GAP), O + r * (CELL + GAP)];
const center = ([r, c]) => { const [x, y] = cellXY(r, c); return [x + CELL / 2, y + CELL / 2]; };

function caseState(notation) {
  const turns = parseMoveSequence(notation, 3);
  const inverse = turns.slice().reverse().map(t => ({ ...t, cw: !t.cw }));
  return inverse.reduce(applyTurn, solvedState(3));
}

export default function CaseDiagram({ notation, mode, size = 52 }) {
  const state = useMemo(() => caseState(notation), [notation]);
  const fill = (color) => (mode === 'oll' ? (color === U ? TOP : GRAY) : COLORS[color].hex);

  // The side strips: the top row of each side face, placed around the U face
  const strips = [];
  for (let k = 0; k < 3; k++) {
    const [x] = cellXY(0, k);
    const [, y] = cellXY(k, 0);
    strips.push(
      { key: `B${k}`, x, y: GAP, w: CELL, h: STRIP, color: state[B][0][2 - k] },
      { key: `F${k}`, x, y: O + 3 * CELL + 2 * GAP + GAP, w: CELL, h: STRIP, color: state[F][0][k] },
      { key: `L${k}`, x: GAP, y, w: STRIP, h: CELL, color: state[L][0][k] },
      { key: `R${k}`, x: O + 3 * CELL + 2 * GAP + GAP, y, w: STRIP, h: CELL, color: state[R][0][2 - k] },
    );
  }

  // PLL arrows: each piece goes from its slot to the slot whose colors it has
  const arrows = useMemo(() => {
    if (mode !== 'pll') return [];
    const solved = solvedState(3);
    const key = (st, slot) => slot.stickers.map(([f, r, c]) => st[f][r][c]).sort().join();
    const homeOf = SLOTS.map(slot => SLOTS.findIndex(h => key(solved, h) === key(state, slot)));
    const out = [];
    homeOf.forEach((h, s) => {
      if (h === s || h < 0) return;
      const both = homeOf[h] === s;
      if (both && h < s) return; // drawn once, with two heads
      out.push({ from: center(SLOTS[s].at), to: center(SLOTS[h].at), both });
    });
    return out;
  }, [mode, state]);

  return (
    <svg className="case-diagram" width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      <defs>
        <marker id="case-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#0c0b09" />
        </marker>
      </defs>
      {[0, 1, 2].flatMap(r => [0, 1, 2].map(c => {
        const [x, y] = cellXY(r, c);
        return <rect key={`u${r}${c}`} x={x} y={y} width={CELL} height={CELL} rx={1.5} fill={fill(state[U][r][c])} />;
      }))}
      {strips.map(s => (
        <rect key={s.key} x={s.x} y={s.y} width={s.w} height={s.h} rx={1} fill={fill(s.color)} />
      ))}
      {arrows.map(({ from, to, both }, i) => {
        const [x0, y0] = from, [x1, y1] = to;
        const d = Math.hypot(x1 - x0, y1 - y0), k = 3.5 / d;
        return (
          <line key={i} x1={x0 + (x1 - x0) * k} y1={y0 + (y1 - y0) * k} x2={x1 - (x1 - x0) * k} y2={y1 - (y1 - y0) * k}
            stroke="#0c0b09" strokeWidth="1.6" markerEnd="url(#case-arrow)" markerStart={both ? 'url(#case-arrow)' : undefined} />
        );
      })}
    </svg>
  );
}
