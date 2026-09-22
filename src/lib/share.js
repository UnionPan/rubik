/**
 * Shareable links: the cube size, scramble and every move since, in the URL
 * fragment, e.g.  #n=4&s=R_U2_Fw'&m=R_U_R'
 * Moves are written in native notation (turnToNotation) so they replay to the
 * identical position, and the exact move path (for the permutation stats)
 * survives the round trip.
 */
import { parseMoveSequence, turnToNotation } from './cubeState';

const SIZES = [2, 3, 4, 5];

const encodeSeq = (seq) => seq.trim().split(/\s+/).filter(Boolean)
  .map(tok => encodeURIComponent(tok).replace(/%27/g, "'"))
  .join('_');
const decodeSeq = (value) => decodeURIComponent(value.replace(/_/g, ' '));

/** Fragment for a position, or '' for the pristine default (solved 3×3) */
export function encodeShareHash({ N, scramble = '', moves = [] }) {
  const m = moves.map(t => turnToNotation(t, N)).filter(Boolean).join(' ');
  if (N === 3 && !scramble && !m) return '';
  const parts = [`n=${N}`];
  if (scramble) parts.push(`s=${encodeSeq(scramble)}`);
  if (m) parts.push(`m=${encodeSeq(m)}`);
  return `#${parts.join('&')}`;
}

/**
 * Parse a fragment into { N, scramble, scrambleTurns, moves }, or null when
 * it is empty or invalid (an invalid link just opens the default cube).
 */
export function decodeShareHash(hash) {
  const body = (hash || '').replace(/^#/, '');
  if (!body) return null;
  const params = {};
  for (const pair of body.split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) params[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  const N = Number(params.n);
  if (!SIZES.includes(N)) return null;
  try {
    const scramble = params.s ? decodeSeq(params.s) : '';
    const scrambleTurns = scramble ? parseMoveSequence(scramble, N) : [];
    const moves = params.m ? parseMoveSequence(decodeSeq(params.m), N) : [];
    return { N, scramble, scrambleTurns, moves };
  } catch {
    return null;
  }
}
