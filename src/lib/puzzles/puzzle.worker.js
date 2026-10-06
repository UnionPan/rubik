/**
 * Enumerates a generic puzzle's whole group off the main thread, then answers
 * questions about positions: optimal distance and solution, and random-state
 * scrambles.
 */
import { getPuzzle } from './index';

let puzzle = null;

self.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      puzzle = getPuzzle(msg.id);
      const { distribution, godsNumber, order } = puzzle.enumerate();
      self.postMessage({ type: 'ready', id: msg.id, distribution, godsNumber, order });
    } else if (msg.type === 'query') {
      const distance = puzzle.distanceToSolved(msg.state);
      const solution = puzzle.solve(msg.state).map(t => t.notation);
      self.postMessage({ type: 'answer', reqId: msg.reqId, distance, solution });
    } else if (msg.type === 'scramble') {
      self.postMessage({ type: 'answer', reqId: msg.reqId, scramble: puzzle.randomScramble() });
    }
  } catch (err) {
    self.postMessage({ type: 'answer', reqId: msg.reqId, error: String(err?.message || err) });
  }
};
