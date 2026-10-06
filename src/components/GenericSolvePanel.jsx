import { useState } from 'react';
import Section from './ui/Section';
import DistanceChart from './DistanceChart';

/**
 * GenericSolvePanel - optimal solutions for the geometry-engine puzzles,
 * read off the enumerated group (usePuzzleOracle).
 */
export default function GenericSolvePanel({ model, state, oracle, animating, playMoveSequence, stateRef }) {
  const [solution, setSolution] = useState(null); // { forState, distance, moves, playing }
  const [solving, setSolving] = useState(false);
  const info = oracle.info;
  const solved = model.isSolved(state);
  // A solution belongs to the position it was found for (and stays up while it plays)
  const current = solution && (solution.forState === state || (animating && solution.playing)) ? solution : null;

  const handleSolve = async () => {
    setSolving(true);
    const answer = await oracle.query(state);
    setSolving(false);
    if (!answer.error) setSolution({ forState: state, distance: answer.distance, moves: answer.solution });
  };
  const handlePlay = () => {
    if (!current) return;
    setSolution({ ...current, playing: true });
    playMoveSequence(model.parseMoveSequence(current.moves.join(' ')), stateRef.current);
  };

  return (
    <div className="panel-stack">
      <Section title="Solve" caption="Optimal: the fewest possible turns, read from a table of every position."
        className="solver-panel">
        <div className={`solver-status-bar ${info ? 'ready' : 'loading'}`}>
          {info
            ? <><span className="ssb-dot green" />All {info.order.toLocaleString('en-US')} positions counted</>
            : <><span className="ssb-dot spin" />Visiting every position…</>}
        </div>
        <button className={`solver-solve-btn ${solving ? 'solving' : ''}`}
          onClick={handleSolve} disabled={!info || solving || animating || solved}>
          {solved ? '✓ Already solved' : solving ? 'Solving…' : '★ Find optimal solution'}
        </button>
        {current && (
          <div className="solver-result">
            <div className="solver-result-header">
              <span className="srh-label">Solution</span>
              <span className="srh-count">{current.distance} moves · optimal</span>
            </div>
            <div className="phase-moves">
              {current.moves.map((m, i) => <span key={i} className="solver-move-token p2">{m}</span>)}
            </div>
            <button className="solver-play-btn" onClick={handlePlay} disabled={animating || solved}>
              {animating ? '⏸ Playing…' : '▶ Animate solution'}
            </button>
          </div>
        )}
      </Section>

      <Section
        title="How it works"
        caption={info ? `God's number for the ${model.name} is ${info.godsNumber}.` : 'Breadth-first search over every position.'}
        why={<p>
          Starting from solved, the site applies every turn to every position it has seen, layer by
          layer, until no new positions appear: {model.groupOrder} in all. Each position remembers its
          layer, its distance from solved. To solve, take any turn that lowers the distance by one, and
          repeat; no shorter solution can exist.
        </p>}
      >
        {(open) => open && info && <DistanceChart distribution={info.distribution} current={current?.distance ?? null} />}
      </Section>
    </div>
  );
}
