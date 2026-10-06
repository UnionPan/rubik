import { useEffect, useState } from 'react';

/**
 * MovesLeft - the exact distance to solved and the next optimal turn, asked
 * from the puzzle's enumerated group (usePuzzleOracle).
 */
export default function MovesLeft({ oracle, state, onPlay, disabled }) {
  const [answer, setAnswer] = useState(null);
  const ready = !!oracle.info;

  useEffect(() => {
    if (!ready) return undefined;
    let current = true;
    oracle.query(state).then(a => { if (current) setAnswer({ ...a, state }); });
    return () => { current = false; };
  }, [oracle, ready, state]);

  if (!ready) return <div className="moves-left muted">Counting every position…</div>;
  if (!answer || answer.state !== state || answer.distance == null) return <div className="moves-left muted">…</div>;
  if (answer.distance === 0) return null;
  const next = answer.solution[0];
  return (
    <div className="moves-left">
      <span><strong>{answer.distance}</strong> move{answer.distance === 1 ? '' : 's'} from solved</span>
      <button className="pd-jump-btn secondary" onClick={() => onPlay(next)} disabled={disabled}
        title="Play the next move of an optimal solution">
        Hint: {next}
      </button>
    </div>
  );
}
