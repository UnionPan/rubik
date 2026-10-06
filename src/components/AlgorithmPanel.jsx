import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { tokenize } from '../lib/algorithms';
import Section from './ui/Section';

/** The inverse of a quarter turn */
function invertTurn(t) {
  const notation = t.notation.endsWith("'") ? t.notation.slice(0, -1) : `${t.notation}'`;
  return { ...t, cw: !t.cw, notation };
}

/**
 * AlgorithmPanel - the algorithm library with a stepper, and the pattern detector.
 * Mount with a key per puzzle: algorithm tokens are resolved for one puzzle.
 * Props:
 *   model: puzzle model (applyTurn)
 *   library: getLibrary(model) - categories, algorithms, token resolution
 *   onAlgorithmSelect: fn(algorithm)
 *   onStepState: fn(state, turns) - state after the current step, and the
 *                quarter turns applied since the algorithm's entry state
 *   baseState: current state to start from
 *   onAlgorithmChange: fn(algo) — tells parent to update algebra panel
 *   detectedPattern: result from detectPattern() in patternRecognition.js
 *   onAnimateStep: fn(turn, onDone) - animates one quarter turn on cube and graph
 *   onApplySetup: fn(notation) - plays a setup sequence (e.g. "U'") on the cube
 *   onEntry: fn() - the stepper is about to start from the current state
 *   detectorExtra: optional element shown inside the detector card
 */
export default function AlgorithmPanel({
  model,
  library,
  onAlgorithmSelect,
  onStepState,
  baseState,
  onAlgorithmChange,
  detectedPattern = null,
  onAnimateStep = null,
  onApplySetup = null,
  onEntry = null,
  detectorExtra = null,
}) {
  const [selectedCategory, setSelectedCategory] = useState(library.defaultCategory);
  const [selectedAlg, setSelectedAlg] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1); // -1 = not playing
  const [playing, setPlaying] = useState(false);
  const [intervalMs, setIntervalMs] = useState(700);
  const [stepping, setStepping] = useState(false); // true while a step animation is running

  // Snapshot of the cube state at the moment the algorithm was selected.
  // We need a stable ref so stepTo always starts from the same base,
  // even after onStepState has updated the parent's state.
  const entryStateRef = useRef(baseState);

  const algList = library.list.filter(a => a.category === selectedCategory);
  const tokens = useMemo(
    () => (selectedAlg ? tokenize(selectedAlg.notation) : []),
    [selectedAlg],
  );
  // Each token resolved to the turns it stands for on this puzzle
  const stepTurns = useMemo(() => {
    if (!selectedAlg) return [];
    return tokens.map(tok => {
      try { return library.resolveToken(selectedAlg, tok); }
      catch { return []; }
    });
  }, [selectedAlg, tokens, library]);

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
    return turnsUpTo(idx).reduce(model.applyTurn, entry);
  }, [turnsUpTo, model]);

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
    const alg = library.find(algId);
    if (!alg) return;
    setSelectedCategory(alg.category);
    selectAlgorithm(alg);
  }, [selectAlgorithm, library]);

  return (
    <div className="panel-stack">
      {/* ── Pattern Detector ── */}
      {detectedPattern && (
        <PatternDetector
          pattern={detectedPattern}
          label={library.label}
          onJump={detectedPattern.matchedAlg ? () => jumpToAlg(detectedPattern.matchedAlg.id) : null}
          onApplySetup={onApplySetup}
          selectedAlgId={selectedAlg?.id}
        >
          {detectorExtra}
        </PatternDetector>
      )}

      {/* ── Library ── */}
      <Section
        title="Library"
        caption="Pick one to step through it on the cube."
        why={library.note ? <p>{library.note}</p> : null}
      >
        <div className="category-tabs">
          {library.categories.map(cat => {
            const count = library.list.filter(a => a.category === cat).length;
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

        <div className="alg-list">
          {algList.length === 0 && (
            <div className="empty-msg">No algorithms in this category for the {library.label}.</div>
          )}
          {algList.map(alg => {
            const selected = selectedAlg?.id === alg.id;
            return (
              <div key={alg.id} className={`alg-item ${selected ? 'selected' : ''}`}>
                <button
                  className="alg-item-head"
                  aria-expanded={selected}
                  onClick={() => (selected ? setSelectedAlg(null) : selectAlgorithm(alg))}
                >
                  <span className="alg-name">{alg.name}</span>
                  <span className="alg-notation">{alg.notation}</span>
                  {alg.algebraNote && <span className="alg-algebra-badge">{alg.algebraNote}</span>}
                </button>
                {selected && (
                  <AlgorithmStepper
                    alg={alg}
                    tokens={tokens}
                    stepIndex={stepIndex}
                    stepping={stepping}
                    playing={playing}
                    intervalMs={intervalMs}
                    onStepTo={stepTo}
                    onReset={reset}
                    onStepBack={stepBack}
                    onStepForward={stepForward}
                    onTogglePlay={() => {
                      if (stepping) return;
                      if (stepIndex >= tokens.length - 1) reset();
                      setPlaying(p => !p);
                    }}
                    onInterval={setIntervalMs}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function AlgorithmStepper({
  alg, tokens, stepIndex, stepping, playing, intervalMs,
  onStepTo, onReset, onStepBack, onStepForward, onTogglePlay, onInterval,
}) {
  return (
    <div className="alg-detail">
      {alg.description && <p className="alg-description">{alg.description}</p>}

      <div className="move-tokens">
        {tokens.map((tok, i) => (
          <button
            key={i}
            className={`move-token ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
            onClick={() => onStepTo(i)}
            title={`Jump to after move ${i + 1}`}
          >
            {tok}
          </button>
        ))}
      </div>

      <div className="playback-controls">
        <button className="ctrl-btn" onClick={onReset} disabled={stepping} title="Reset">⏮</button>
        <button className="ctrl-btn" onClick={onStepBack} disabled={stepping || stepIndex < 0} title="Step back">◀</button>
        <button
          className={`ctrl-btn play-btn ${playing ? 'active' : ''}`}
          onClick={onTogglePlay}
          title={playing ? 'Pause' : 'Play'}
          disabled={stepping}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button className="ctrl-btn" onClick={onStepForward} disabled={stepping || stepIndex >= tokens.length - 1} title="Step forward">▶</button>
        <div className="speed-control" title="Pause between moves while playing">
          <input
            type="range"
            min={200}
            max={1500}
            step={100}
            value={1700 - intervalMs}
            onChange={e => onInterval(1700 - Number(e.target.value))}
            className="speed-slider"
            aria-label="Playback speed"
          />
        </div>
      </div>

      <div className="step-progress">
        <div
          className="step-bar"
          style={{ width: `${stepIndex < 0 ? 0 : ((stepIndex + 1) / tokens.length) * 100}%` }}
        />
      </div>
      <div className="step-label">
        {stepIndex < 0 ? 'Ready' : `${stepIndex + 1} / ${tokens.length}`} · <kbd>←</kbd> <kbd>→</kbd> step · <kbd>Space</kbd> play
      </div>
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
  'first-face':    { color: '#fb923c', icon: '▭' },
  'second-face':   { color: '#fdba74', icon: '▭' },
  leaves:          { color: '#a3e635', icon: '❦' },
  'first-corners': { color: '#fb923c', icon: '◆' },
  'other-corners': { color: '#fdba74', icon: '◆' },
};

function PatternDetector({ pattern, label, onJump, onApplySetup, selectedAlgId, children }) {
  const meta = STAGE_META[pattern.stage] || STAGE_META.cross;
  const { progress, matchedAlg } = pattern;
  const isParity = pattern.stage.endsWith('parity');
  // Parity warnings are actionable, so they stay visible; the rest is explanation
  const warnings = pattern.notes.filter(n => n.startsWith('Heads-up'));
  const explanation = pattern.notes.filter(n => !n.startsWith('Heads-up'));

  return (
    <Section
      title={`Detector · ${pattern.method} · ${label}`}
      className={`pattern-detector${isParity ? ' parity' : ''}`}
      style={{ borderLeftColor: meta.color }}
      aside={(
        <span className="pd-stage-badge" style={{ background: meta.color }}>
          {meta.icon} {pattern.stageLabel}
        </span>
      )}
      why={explanation.length > 0 ? explanation.map(n => <p key={n}>{n}</p>) : null}
    >
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

      {children}

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
              <button className="pd-jump-btn" onClick={onJump}>→ View</button>
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

      {warnings.length > 0 && (
        <div className="pd-warnings">
          {warnings.map(w => (
            <span key={w} className="pd-warning" title={w}>
              ⚠ {w.includes('OLL') ? 'OLL parity ahead' : 'PLL parity ahead'}
            </span>
          ))}
        </div>
      )}
    </Section>
  );
}
