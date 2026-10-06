/**
 * Shareable links: the puzzle, scramble and every move since, in the URL
 * fragment, e.g.  #n=4&s=R_U2_Fw'&m=R_U_R'  (cubes, by size)
 *                 #p=ivy&s=F_U'_L&m=R      (other puzzles, by id)
 * Moves are written as native notation (model.turnToNotation) so they replay
 * to the identical position, and the exact move path survives the round trip.
 */
import { getModel, isPuzzleId } from './puzzles/models';

const encodeSeq = (seq) => seq.trim().split(/\s+/).filter(Boolean)
  .map(tok => encodeURIComponent(tok).replace(/%27/g, "'"))
  .join('_');
const decodeSeq = (value) => decodeURIComponent(value.replace(/_/g, ' '));

/** Fragment for a position, or '' for the pristine default (solved 3×3) */
export function encodeShareHash({ model, scramble = '', moves = [] }) {
  const m = moves.map(t => model.turnToNotation(t)).filter(Boolean).join(' ');
  if (model.id === 'cube3' && !scramble && !m) return '';
  const parts = [model.kind === 'cube' ? `n=${model.N}` : `p=${model.id}`];
  if (scramble) parts.push(`s=${encodeSeq(scramble)}`);
  if (m) parts.push(`m=${encodeSeq(m)}`);
  return `#${parts.join('&')}`;
}

/**
 * Parse a fragment into { puzzleId, scramble, scrambleTurns, moves }, or null
 * when it is empty or invalid (an invalid link just opens the default cube).
 */
export function decodeShareHash(hash) {
  const body = (hash || '').replace(/^#/, '');
  if (!body) return null;
  const params = {};
  for (const pair of body.split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) params[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  const puzzleId = params.p ? params.p : params.n ? `cube${params.n}` : null;
  if (!puzzleId || !isPuzzleId(puzzleId)) return null;
  const model = getModel(puzzleId);
  try {
    const scramble = params.s ? decodeSeq(params.s) : '';
    const scrambleTurns = scramble ? model.parseMoveSequence(scramble) : [];
    const moves = params.m ? model.parseMoveSequence(decodeSeq(params.m)) : [];
    return { puzzleId, scramble, scrambleTurns, moves };
  } catch {
    return null;
  }
}
