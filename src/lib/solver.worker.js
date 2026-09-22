import { initTables, solveFacelets } from './twophase';

// Build the move and pruning tables once (≈0.3 s) so solves are fast.
initTables();
self.postMessage({ type: 'ready' });

self.onmessage = (e) => {
  const { id, facelets } = e.data;
  try {
    const { moves, phase1Length } = solveFacelets(facelets);
    self.postMessage({ id, moves, phase1Length, error: null });
  } catch (err) {
    self.postMessage({ id, moves: null, error: String(err?.message || err) });
  }
};
