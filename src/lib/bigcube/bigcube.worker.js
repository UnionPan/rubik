import { initTables } from '../twophase';
import { solveBigCube } from './solve';

// Builds its tables on the first request (about two seconds), then reuses them.
self.onmessage = (e) => {
  const { id, state, N } = e.data;
  try {
    self.postMessage({ type: 'progress', id, step: 'tables' });
    initTables();
    const { stages } = solveBigCube(state, N, {
      onProgress: (step) => self.postMessage({ type: 'progress', id, step }),
    });
    self.postMessage({ type: 'result', id, stages });
  } catch (err) {
    self.postMessage({ type: 'result', id, error: String(err?.message || err) });
  }
};
