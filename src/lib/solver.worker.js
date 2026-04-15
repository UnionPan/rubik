import cubeSolver from 'cube-solver';

// Pre-initialize Kociemba lookup tables (~1-2s on first load).
// Doing this at startup so the first solve request is fast.
cubeSolver.initialize('kociemba');
self.postMessage({ type: 'ready' });

self.onmessage = (e) => {
  const { id, scramble } = e.data;
  try {
    if (!scramble || scramble.trim() === '') {
      // Empty scramble = solved cube → no moves needed
      self.postMessage({ id, solution: '', error: null });
      return;
    }
    const solution = cubeSolver.solve(scramble.trim(), 'kociemba');
    self.postMessage({ id, solution: solution || '', error: null });
  } catch (err) {
    self.postMessage({ id, solution: null, error: String(err?.message || err) });
  }
};
