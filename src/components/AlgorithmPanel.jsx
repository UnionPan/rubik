import { useState, useEffect, useCallback, useRef } from 'react';
import { ALGORITHMS, ALGORITHM_CATEGORIES, getAlgorithmsForSize, tokenize } from '../lib/algorithms';
import { applyNotation, solvedState, parseMove } from '../lib/cubeState';

/**
 * AlgorithmPanel
 * Props:
 *   cubeSize: N
 *   onAlgorithmSelect: fn(algorithm)
 *   onStepState: fn(state, moveIdx, totalMoves)
 *   baseState: current state to start from
 *   onAlgorithmChange: fn(algo) — tells parent to update algebra panel
 *   detectedPattern: result from detectPattern() in patternRecognition.js
 */
export default function AlgorithmPanel({
  cubeSize = 3,
  onAlgorithmSelect,
  onStepState,
  baseState,
  onAlgorithmChange,
  detectedPattern = null,
  onAnimateStep = null,   // animateAlgStep from App: (face, layer, cw, onDone) => void
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
  const tokens = selectedAlg ? tokenize(selectedAlg.notation) : [];

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
    let s = entry;
    for (let i = 0; i <= idx; i++) s = applyNotation(s, tokens[i]);
    return s;
  }, [tokens]);

  // Non-animated fallback: jump state directly.
  const stepTo = useCallback((idx) => {
    if (!selectedAlg) return;
    const s = computeState(idx);
    setStepIndex(idx);
    if (onStepState) onStepState(s, idx, tokens.length - 1);
  }, [selectedAlg, computeState, tokens.length, onStepState]);

  // Animated step forward: play the 3D animation for tokens[next], then update state.
  const stepForward = useCallback(() => {
    if (stepping) return;
    const next = stepIndex + 1;
    if (next >= tokens.length) { setPlaying(false); return; }

    const mv = parseMove(tokens[next]);
    const targetState = computeState(next);

    if (onAnimateStep && mv) {
      setStepping(true);
      setStepIndex(next);
      // For double moves (F2), chain two 90° animations.
      const doAnim = (times, onDone) => {
        if (times <= 0) { onDone(); return; }
        onAnimateStep(mv.face, mv.layer, mv.cw, () => doAnim(times - 1, onDone));
      };
      doAnim(mv.double ? 2 : 1, () => {
        setStepping(false);
        if (onStepState) onStepState(targetState, next, tokens.length - 1);
        if (next >= tokens.length - 1) setPlaying(false);
      });
    } else {
      // No animation: just snap.
      setStepIndex(next);
      if (onStepState) onStepState(targetState, next, tokens.length - 1);
      if (next >= tokens.length - 1) setPlaying(false);
    }
  }, [stepping, stepIndex, tokens, computeState, onAnimateStep, onStepState]);

  // Animated step backward: play the inverse of the current token, then update state.
  const stepBack = useCallback(() => {
    if (stepping) return;
    const prev = stepIndex - 1;
    const targetState = prev < 0 ? entryStateRef.current : computeState(prev);

    if (stepIndex >= 0 && onAnimateStep) {
      const mv = parseMove(tokens[stepIndex]);
      if (mv) {
        setStepping(true);
        setStepIndex(prev);
        const doAnim = (times, onDone) => {
          if (times <= 0) { onDone(); return; }
          onAnimateStep(mv.face, mv.layer, !mv.cw, () => doAnim(times - 1, onDone));
        };
        doAnim(mv.double ? 2 : 1, () => {
          setStepping(false);
          if (onStepState) onStepState(targetState, prev, tokens.length - 1);
        });
        return;
      }
    }
    // Fallback / already at start
    setStepIndex(prev);
    if (onStepState) onStepState(targetState, prev, tokens.length - 1);
  }, [stepping, stepIndex, tokens, computeState, onAnimateStep, onStepState]);

  const reset = useCallback(() => {
    setStepIndex(-1);
    setPlaying(false);
    setStepping(false);
    if (onStepState) onStepState(entryStateRef.current, -1, tokens.length - 1);
  }, [tokens.length, onStepState]);

  // Auto-play
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(stepForward, intervalMs);
    return () => clearInterval(id);
  }, [playing, stepForward, intervalMs]);

  // Keyboard controls
  useEffect(() => {
    const onKey = e => {
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
          onJump={detectedPattern.matchedAlg ? () => jumpToAlg(detectedPattern.matchedAlg.id) : null}
        />
      )}

      {/* Stage explanation strip */}
      <div className="stage-explainer">
        <span className="stage-explainer-text">
          {cubeSize === 3
            ? 'CFOP method: Cross → F2L → OLL → PLL. Select a stage above to see algorithms.'
            : 'Big cube: reduce to 3×3 first. Then apply CFOP last-layer algorithms.'}
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
  solved:    { label: 'Solved',    color: 'var(--green)',  icon: '✓' },
  pll:       { label: 'PLL',       color: 'var(--blue)',   icon: '⤢' },
  oll:       { label: 'OLL',       color: 'var(--yellow)', icon: '◑' },
  f2l:       { label: 'F2L',       color: 'var(--orange)', icon: '⬛' },
  cross:     { label: 'Cross',     color: 'var(--orange)', icon: '✛' },
  scrambled: { label: 'Scrambled', color: 'var(--red)',    icon: '⟳' },
  other:     { label: 'N/A',       color: '#666',          icon: '—' },
};

function PatternDetector({ pattern, onJump }) {
  const meta = STAGE_META[pattern.stage] || STAGE_META.other;

  return (
    <div className="pattern-detector">
      <div className="pd-header">
        <span className="pd-label">Pattern Detector</span>
        <span className="pd-stage-badge" style={{ background: meta.color }}>
          {meta.icon} {meta.label}
        </span>
      </div>
      <div className="pd-message">{pattern.message}</div>
      {pattern.matchedAlg && (
        <div className="pd-match">
          <span className="pd-match-name">{pattern.matchedAlg.name}</span>
          <span className="pd-match-notation">{pattern.matchedAlg.notation}</span>
          {onJump && (
            <button className="pd-jump-btn" onClick={onJump}>
              → View algorithm
            </button>
          )}
        </div>
      )}
      {pattern.edgeInfo && !pattern.matchedAlg && (
        <div className="pd-edge-info">
          <span className={`pd-edge-badge ${pattern.edgeInfo.pattern}`}>
            {pattern.edgeInfo.label}
          </span>
        </div>
      )}
    </div>
  );
}
