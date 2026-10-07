import { useMemo } from 'react';
import { applyTurn } from '../lib/cubeState';

const STAGE_TEXT = {
  centers: 'Every face gets a middle of one color.',
  parity: 'The edges are in an order a 3×3 can never have; one special algorithm fixes that.',
  edges: 'The pieces of each edge are matched up, three at a time.',
  '3x3': 'Now it turns like a 3×3, and the two-phase solver finishes it.',
};
const PREVIEW = 14;

const keyOf = (state) => state.flat(2).join('');

/** Notation tokens for display: two equal quarter turns read as one half turn */
function tokens(turns) {
  const out = [];
  for (let i = 0; i < turns.length; i++) {
    const n = turns[i].notation;
    if (turns[i + 1]?.notation === n && !n.includes(' ')) { out.push(n.replace("'", '') + '2'); i++; }
    else out.push(n);
  }
  return out;
}

/**
 * BigCubeSolution - a solution in stages, each played on its own.
 * Every position along the solution is known, so the view finds the cube's
 * place on it (stage and turn) and follows along while it plays.
 * Props: solution { start, stages: [{ id, label, turns }] }, state, animating, onPlay(turns)
 */
export default function BigCubeSolution({ solution, state, animating, onPlay }) {
  // position key → [stage, turns of that stage already done]
  const along = useMemo(() => {
    const map = new Map();
    let s = solution.start;
    solution.stages.forEach((stage, i) => {
      stage.turns.forEach((t, k) => {
        if (!map.has(keyOf(s))) map.set(keyOf(s), [i, k]);
        s = applyTurn(s, t);
      });
    });
    map.set(keyOf(s), [solution.stages.length, 0]);
    return map;
  }, [solution]);
  const place = along.get(keyOf(state));
  if (!place) return null; // the cube left the solution's path
  const [at, done] = place;

  const total = solution.stages.reduce((n, s) => n + s.turns.length, 0);
  const remaining = solution.stages.slice(at).flatMap(s => s.turns).slice(done);

  return (
    <div className="bc-solution">
      <div className="bc-summary">
        {at === solution.stages.length
          ? <>✓ Solved in {total} quarter turns.</>
          : <>{total} quarter turns in {solution.stages.length} stages. Play them one at a time, or all at once.</>}
      </div>
      <ol className="bc-stages">
        {solution.stages.map((stage, i) => {
          const status = i < at ? 'done' : i === at ? 'current' : 'todo';
          const toks = tokens(stage.turns);
          return (
            <li key={stage.id} className={`bc-stage ${status}`}>
              <div className="bc-stage-head">
                <span className="bc-stage-name">{status === 'done' ? '✓ ' : ''}{stage.label}</span>
                <span className="bc-stage-count">
                  {status === 'current' && done > 0 ? `${done} of ${stage.turns.length}` : stage.turns.length} turns
                </span>
                {status === 'current' && (
                  <button className="bc-play" onClick={() => onPlay(stage.turns.slice(done))} disabled={animating}>
                    {animating ? 'Playing…' : done > 0 ? '▶ Continue' : '▶ Play'}
                  </button>
                )}
              </div>
              <p className="bc-stage-text">{STAGE_TEXT[stage.id]}</p>
              {status === 'current' && done > 0 && (
                <div className="bc-progress"><span style={{ width: `${(done / stage.turns.length) * 100}%` }} /></div>
              )}
              <div className="bc-moves">
                {toks.slice(0, PREVIEW).map((t, k) => <span key={k}>{t}</span>)}
                {toks.length > PREVIEW && <span className="bc-more">+{toks.length - PREVIEW} more</span>}
              </div>
            </li>
          );
        })}
      </ol>
      {at < solution.stages.length && (
        <button className="solver-play-btn" onClick={() => onPlay(remaining)} disabled={animating}>
          {animating ? 'Playing…' : `▶ Play all ${remaining.length} turns`}
        </button>
      )}
    </div>
  );
}
