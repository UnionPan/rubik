import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * For a generic puzzle: a worker that enumerates every position, then answers
 *   query(state)  → Promise<{ distance, solution: string[] }>
 *   scramble()    → Promise<{ scramble }>
 * `info` is null until the enumeration is done, then
 *   { distribution, godsNumber, order }.
 * For cubes (puzzleId null) it does nothing.
 */
export default function usePuzzleOracle(puzzleId) {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const reqRef = useRef(0);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!puzzleId) return undefined;
    const worker = new Worker(new URL('../lib/puzzles/puzzle.worker.js', import.meta.url), { type: 'module' });
    const pending = pendingRef.current;
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'ready') { setInfo(msg); return; }
      const resolve = pending.get(msg.reqId);
      pending.delete(msg.reqId);
      resolve?.(msg);
    };
    worker.postMessage({ type: 'init', id: puzzleId });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.clear();
      setInfo(null);
    };
  }, [puzzleId]);

  const ask = useCallback((payload) => new Promise((resolve) => {
    if (!workerRef.current) { resolve({ error: 'not available' }); return; }
    const reqId = ++reqRef.current;
    pendingRef.current.set(reqId, resolve);
    workerRef.current.postMessage({ ...payload, reqId });
  }), []);

  const query = useCallback((state) => ask({ type: 'query', state }), [ask]);
  const scramble = useCallback(() => ask({ type: 'scramble' }), [ask]);

  return { info, query, scramble };
}
