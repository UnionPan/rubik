import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ALGORITHMS, ALGORITHM_CATEGORIES, getAlgorithmsForSize, tokenize, usesReducedNotation,
} from '../lib/algorithms';
import { applyTurn, parseToken, expandToken } from '../lib/cubeState';

/** The inverse of a quarter turn */
function invertTurn(t) {
  const notation = t.notation.endsWith("'") ? t.notation.slice(0, -1) : `${t.notation}'`;
  return { ...t, cw: !t.cw, notation };
}

/**
 * AlgorithmPanel
 * Mount with key={cubeSize}: algorithm tokens are resolved for one cube size.
 * Props:
 *   cubeSize: N
 *   onAlgorithmSelect: fn(algorithm)
 *   onStepState: fn(state, turns) - state after the current step, and the
 *                quarter turns applied since the algorithm's entry state
 *   baseState: current state to start from
 *   onAlgorithmChange: fn(algo) — tells parent to update algebra panel
 *   detectedPattern: result from detectPattern() in patternRecognition.js
 *   onAnimateStep: fn(turn, onDone) - animates one quarter turn on cube and graph
 *   onApplySetup: fn(notation) - plays a setup sequence (e.g. "U'") on the cube
 *   onEntry: fn() - the stepper is about to start from the current state
 */
export default function AlgorithmPanel({
  cubeSize = 3,
  onAlgorithmSelect,
  onStepState,
  baseState,
  onAlgorithmChange,
  detectedPattern = null,
  onAnimateStep = null,
  onApplySetup = null,
  onEntry = null,
}) {
  const [selectedCategory, setSelectedCategory] = useState('Beginner');
  const [selectedAlg, setSelectedAlg] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1); // -1 = not playing
  const [playing, setPlaying] = useState(false);
  const [intervalMs, setIntervalMs] = useState(700);
  const [stepping, setStepping] = useState(false); // true while a step animation is running

  // Snapshot of the cube state at the moment the algorithm was selected.
  // We need a stable ref so stepTo always starts from the same base,
  // even after onStepState has updated the parent's state.
  const entryStateRef = useRef(baseState);

  const algList = getAlgorithmsForSize(cubeSize).filter(
    a => a.category === selectedCategory
  );
  const tokens = useMemo(
    () => (selectedAlg ? tokenize(selectedAlg.notation) : []),
    [selectedAlg],
  );
  // Each token resolved to quarter turns for this cube size.  3×3 algorithms
  // run on big cubes through the reduction map (see cubeState notation notes).
  const stepTurns = useMemo(() => {
    if (!selectedAlg) return [];
    const reduced = usesReducedNotation(selectedAlg);
    return tokens.map(tok => {
      try { return expandToken(parseToken(tok, cubeSize, { reduced })); }
      catch { return []; }
    });
  }, [selectedAlg, tokens, cubeSize]);

  const turnsUpTo = useCallback(
    (idx) => stepTurns.slice(0, idx + 1).flat(),
    [stepTurns],
  );

  // Select algorithm — snapshot the current cube state so stepping always starts here
  const selectAlgorithm = useCallback((alg) => {
    entryStateRef.current = baseState; // freeze the entry state at click time
    setSelectedAlg(alg);
    setStepIndex(-1);
    setPlaying(false);
    if (onAlgorithmChange) onAlgorithmChange(alg);
    if (onAlgorithmSelect) onAlgorithmSelect(alg);
  }, [onAlgorithmSelect, onAlgorithmChange, baseState]);

  // Compute the full logical state after applying tokens[0..idx] to the entry state.
  const computeState = useCallback((idx) => {
    const entry = entryStateRef.current;
    if (!entry || idx < 0) return entry;
    return turnsUpTo(idx).reduce(applyTurn, entry);
  }, [turnsUpTo]);

  // Before the first step, the algorithm starts from whatever the cube shows now
  // (the user may have made a setup turn since selecting it).
  const syncEntry = useCallback(() => {
    if (stepIndex >= 0) return;
    entryStateRef.current = baseState;
    onEntry?.();
  }, [stepIndex, baseState, onEntry]);

  // Non-animated fallback: jump state directly.
  const stepTo = useCallback((idx) => {
    if (!selectedAlg) return;
    syncEntry();
    const s = computeState(idx);
    setStepIndex(idx);
    if (onStepState) onStepState(s, turnsUpTo(idx));
  }, [selectedAlg, syncEntry, computeState, turnsUpTo, onStepState]);

  // Play quarter turns one after another, then call onDone
  const animateTurns = useCallback((turns, onDone) => {
    const run = (i) => {
      if (i >= turns.length) { onDone(); return; }
      onAnimateStep(turns[i], () => run(i + 1));
    };
    run(0);
  }, [onAnimateStep]);

  // Animated step forward: animate tokens[next] (half turns as two quarter turns), then update state.
  const stepForward = useCallback(() => {
    if (stepping) return;
    const next = stepIndex + 1;
    if (next >= tokens.length) { setPlaying(false); return; }

    syncEntry();
    const targetState = computeState(next);
    const history = turnsUpTo(next);
    const done = () => {
      if (onStepState) onStepState(targetState, history);
      if (next >= tokens.length - 1) setPlaying(false);
    };

    setStepIndex(next);
    if (onAnimateStep) {
      setStepping(true);
      animateTurns(stepTurns[next], () => { setStepping(false); done(); });
    } else {
      done();
    }
  }, [stepping, stepIndex, tokens.length, syncEntry, computeState, turnsUpTo, stepTurns, onAnimateStep, animateTurns, onStepState]);

  // Animated step backward: play the inverse of the current token, then update state.
  const stepBack = useCallback(() => {
    if (stepping || stepIndex < 0) return;
    const prev = stepIndex - 1;
    const targetState = prev < 0 ? entryStateRef.current : computeState(prev);
    const history = turnsUpTo(prev);
    const inverse = [...stepTurns[stepIndex]].reverse().map(invertTurn);

    setStepIndex(prev);
    if (onAnimateStep) {
      setStepping(true);
      animateTurns(inverse, () => {
        setStepping(false);
        if (onStepState) onStepState(targetState, history);
      });
    } else if (onStepState) {
      onStepState(targetState, history);
    }
  }, [stepping, stepIndex, computeState, turnsUpTo, stepTurns, onAnimateStep, animateTurns, onStepState]);

  const reset = useCallback(() => {
    if (stepIndex < 0) return; // not started: nothing to undo
    setStepIndex(-1);
    setPlaying(false);
    setStepping(false);
    if (onStepState) onStepState(entryStateRef.current, []);
  }, [stepIndex, onStepState]);

  // Auto-play
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(stepForward, intervalMs);
    return () => clearInterval(id);
  }, [playing, stepForward, intervalMs]);

  // Keyboard controls
  useEffect(() => {
    const onKey = e => {
      // Leave keys alone while typing or when another control handled them
      if (e.defaultPrevented) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"], [role="separator"]')) return;
      if (e.key === 'ArrowRight') stepForward();
      if (e.key === 'ArrowLeft') stepBack();
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepForward, stepBack]);

  // Jump to a specific algorithm by id (select it and scroll)
  const jumpToAlg = useCallback((algId) => {
    const alg = ALGORITHMS.find(a => a.id === algId);
    if (!alg) return;
    setSelectedCategory(alg.category);
    selectAlgorithm(alg);
  }, [selectAlgorithm]);

  return (
    <div className="algorithm-panel">
      <h3 className="panel-title"><span className="icon">▶</span> Algorithms</h3>

      {/* ── Pattern Detector ── */}
      {detectedPattern && (
        <PatternDetector
          pattern={detectedPattern}
          cubeSize={cubeSize}
          onJump={detectedPattern.matchedAlg ? () => jumpToAlg(detectedPattern.matchedAlg.id) : null}
          onApplySetup={onApplySetup}
          selectedAlgId={selectedAlg?.id}
        />
      )}

      {/* Stage explanation strip */}
      <div className="stage-explainer">
        <span className="stage-explainer-text">
          {cubeSize === 2 && 'Layer by layer: first layer → OLL → PLL. 3×3 last-layer algorithms act on the corners alone.'}
          {cubeSize === 3 && 'CFOP method: Cross → F2L → OLL → PLL. Select a stage above to see algorithms.'}
          {cubeSize > 3 && 'Reduction: solve the centers, pair the edges, then solve it like a 3×3. 3×3 algorithms run on the reduced cube with M, E, S and wide turns covering all inner slices.'}
        </span>
      </div>

      {/* Category tabs */}
      <div className="category-tabs">
        {ALGORITHM_CATEGORIES.map(cat => {
          const count = getAlgorithmsForSize(cubeSize).filter(a => a.category === cat).length;
          return (
            <button
              key={cat}
              className={`cat-tab ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => { setSelectedCategory(cat); setSelectedAlg(null); setStepIndex(-1); }}
              disabled={count === 0}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Algorithm list */}
      <div className="alg-list">
        {algList.length === 0 && (
          <div className="empty-msg">No algorithms in this category for {cubeSize}×{cubeSize}.</div>
        )}
        {algList.map(alg => (
          <div
            key={alg.id}
            className={`alg-item ${selectedAlg?.id === alg.id ? 'selected' : ''}`}
            onClick={() => selectAlgorithm(alg)}
          >
            <div className="alg-name">{alg.name}</div>
            <div className="alg-notation">{alg.notation}</div>
            {alg.algebraNote && (
              <div className="alg-algebra-badge">{alg.algebraNote}</div>
            )}
          </div>
        ))}
      </div>

      {/* Selected algorithm details + stepper */}
      {selectedAlg && (
        <div className="alg-detail">
          <div className="alg-detail-name">{selectedAlg.name}</div>
          {selectedAlg.category === 'OLL' && (
            <div className="alg-stage-pill oll">OLL — orients last-layer stickers</div>
          )}
          {selectedAlg.category === 'PLL' && (
            <div className="alg-stage-pill pll">PLL — permutes last-layer pieces</div>
          )}
          <p className="alg-description">{selectedAlg.description}</p>

          {/* Move sequence tokens */}
          <div className="move-tokens">
            {tokens.map((tok, i) => (
              <button
                key={i}
                className={`move-token ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
                onClick={() => stepTo(i)}
                title={`Apply moves 0–${i}`}
              >
                {tok}
              </button>
            ))}
          </div>

          {/* Playback controls */}
          <div className="playback-controls">
            <button className="ctrl-btn" onClick={reset} disabled={stepping} title="Reset">⏮</button>
            <button className="ctrl-btn" onClick={stepBack} disabled={stepping || stepIndex < 0} title="Step back">◀</button>
            <button
              className={`ctrl-btn play-btn ${playing ? 'active' : ''}`}
              onClick={() => {
                if (stepping) return;
                if (stepIndex >= tokens.length - 1) reset();
                setPlaying(p => !p);
              }}
              title={playing ? 'Pause' : 'Play'}
              disabled={stepping}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button className="ctrl-btn" onClick={stepForward} disabled={stepping || stepIndex >= tokens.length - 1} title="Step forward">▶</button>
            <div className="speed-control">
              <span className="speed-label">Speed</span>
              <input
                type="range"
                min={200}
                max={1500}
                step={100}
                value={intervalMs}
                onChange={e => setIntervalMs(Number(e.target.value))}
                className="speed-slider"
              />
            </div>
          </div>

          {/* Progress */}
          <div className="step-progress">
            <div
              className="step-bar"
              style={{ width: `${stepIndex < 0 ? 0 : ((stepIndex + 1) / tokens.length) * 100}%` }}
            />
          </div>
          <div className="step-label">
            {stepIndex < 0 ? 'Ready' : `Move ${stepIndex + 1} / ${tokens.length}: ${tokens[stepIndex]}`}
          </div>
          <div className="keyboard-hint">← → arrow keys · Space to play/pause</div>
        </div>
      )}
    </div>
  );
}

// ── PatternDetector ─────────────────────────────────────────────────────────

const STAGE_META = {
  solved:        { color: '#34d399', icon: '✓' },
  'first-layer': { color: '#fb923c', icon: '▭' },
  centers:       { color: '#c4b5fd', icon: '▣' },
  edges:         { color: '#7dd3fc', icon: '═' },
  cross:         { color: '#fb923c', icon: '✛' },
  f2l:           { color: '#fdba74', icon: '⬛' },
  oll:           { color: '#fde047', icon: '◑' },
  'oll-parity':  { color: '#fca5a5', icon: '±' },
  pll:           { color: '#93c5fd', icon: '⤢' },
  'pll-parity':  { color: '#fca5a5', icon: '±' },
};

function PatternDetector({ pattern, cubeSize, onJump, onApplySetup, selectedAlgId }) {
  const meta = STAGE_META[pattern.stage] || STAGE_META.cross;
  const { progress, matchedAlg } = pattern;
  const isParity = pattern.stage.endsWith('parity');

  return (
    <div className={`pattern-detector${isParity ? ' parity' : ''}`} style={{ borderLeftColor: meta.color }}>
      <div className="pd-header">
        <span className="pd-label">Pattern Detector · {pattern.method} {cubeSize}×{cubeSize}</span>
        <span className="pd-stage-badge" style={{ background: meta.color }}>
          {meta.icon} {pattern.stageLabel}
        </span>
      </div>

      {pattern.steps.length > 0 && (
        <ol className="pd-steps" aria-label="Solve stages">
          {pattern.steps.map(st => (
            <li key={st.id} className={`pd-step ${st.status}`}>
              {st.status === 'done' ? '✓ ' : ''}{st.label}
            </li>
          ))}
        </ol>
      )}

      <div className="pd-message">{pattern.message}</div>

      {progress && (
        <div className="pd-progress" title={`${progress.done} of ${progress.total} ${progress.unit}`}>
          <span className="pd-progress-bar">
            <span className="pd-progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%`, background: meta.color }} />
          </span>
          <span className="pd-progress-text">{progress.done}/{progress.total} {progress.unit}</span>
        </div>
      )}

      {matchedAlg && (
        <div className="pd-match">
          <span className="pd-match-kind">{pattern.matchKind === 'exact' ? 'Detected' : 'Try'}</span>
          <span className="pd-chain">
            {pattern.setup && <span className="pd-auf" title="Turn the top layer first">{pattern.setup}</span>}
            {pattern.setup && <span className="pd-arrow">→</span>}
            <span className="pd-match-name">{matchedAlg.name}</span>
            {pattern.finish && <span className="pd-arrow">→</span>}
            {pattern.finish && <span className="pd-auf" title="Turn the top layer afterwards">{pattern.finish}</span>}
          </span>
          <span className="pd-match-notation">{matchedAlg.notation}</span>
          <span className="pd-actions">
            {pattern.setup && onApplySetup && (
              <button className="pd-jump-btn secondary" onClick={() => onApplySetup(pattern.setup)}>
                Do {pattern.setup}
              </button>
            )}
            {onJump && selectedAlgId !== matchedAlg.id && (
              <button className="pd-jump-btn" onClick={onJump}>→ View algorithm</button>
            )}
          </span>
        </div>
      )}

      {pattern.edgeInfo && !matchedAlg && (
        <div className="pd-edge-info">
          <span className={`pd-edge-badge ${pattern.edgeInfo.pattern}`}>
            {pattern.edgeInfo.label}
          </span>
        </div>
      )}

      {pattern.notes.length > 0 && (
        <ul className="pd-notes">
          {pattern.notes.map(n => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
