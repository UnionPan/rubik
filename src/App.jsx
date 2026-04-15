import { useState, useCallback, useRef, useMemo } from 'react';
import CubeViewer3D, { FlatCubeMap } from './components/CubeViewer3D';
import AlgebraPanel from './components/AlgebraPanel';
import AlgorithmPanel from './components/AlgorithmPanel';
import MoveControls from './components/MoveControls';
import GuidePanel from './components/GuidePanel';
import SolverPanel from './components/SolverPanel';
import {
  solvedState, applyMove, applyMoveSequence,
  randomScramble, isSolved, parseMoveSequence,
} from './lib/cubeState';
import { detectPattern } from './lib/patternRecognition';
import './App.css';

const CUBE_SIZES  = [2, 3, 4, 5];
const SIZE_LABELS = { 2: '2×2 Pocket', 3: '3×3 Classic', 4: '4×4 Revenge', 5: '5×5 Professor' };
const GROUP_ORDERS = { 2: '3.7×10⁶', 3: '4.3×10¹⁹', 4: '7.4×10⁴⁵', 5: '2.8×10⁷⁴' };

// Animation duration at speed=1: 600ms; at speed=5: 120ms
const speedToDuration = (speed) => Math.round(600 / speed);

export default function App() {
  const [cubeSize, setCubeSize]       = useState(3);
  const [state, setState]             = useState(() => solvedState(3));
  const [moveHistory, setMoveHistory] = useState([]);
  const [currentAlgorithm, setCurrentAlgorithm] = useState(null);
  const [highlightFace, setHighlightFace]       = useState(null);
  const [showFlatMap, setShowFlatMap]           = useState(false);
  const [customInput, setCustomInput]           = useState('');
  const [inputError, setInputError]             = useState('');
  const [scrambleMsg, setScrambleMsg]           = useState('');
  const [activeTab, setActiveTab]               = useState('guide');
  const [animating, setAnimating]               = useState(false);
  const [animSpeed, setAnimSpeed]               = useState(2); // 0.5–5x

  // Ref that CubeViewer3D populates with animateSlice(face, layer, cw, durationMs, onComplete)
  const animateMoveRef = useRef(null);

  // Keep speed in a ref so the closure inside playMoveSequence always sees current value
  const animSpeedRef   = useRef(animSpeed);
  const sequenceRunRef = useRef(false); // true while a sequence is playing
  // Keep current state in a ref so playMoveSequence/handleCustomInput can read it without stale closure
  const stateRef = useRef(state);
  const updateState = useCallback((s) => {
    setState(s);
    stateRef.current = s;
  }, []);

  const handleSpeedChange = useCallback((v) => {
    setAnimSpeed(v);
    animSpeedRef.current = v;
  }, []);

  // ── Size change ──────────────────────────────────────────────────────
  const handleSizeChange = useCallback((n) => {
    if (sequenceRunRef.current) return; // don't switch mid-sequence
    const newState = solvedState(n);
    setCubeSize(n);
    setState(newState);
    stateRef.current = newState; // keep ref in sync so first move after resize uses correct state
    setMoveHistory([]);
    setCurrentAlgorithm(null);
    setHighlightFace(null);
    setScrambleMsg('');
    setCustomInput('');
  }, []);

  // ── Play an array of parsed moves sequentially, each with animation ──
  // parsedMoves: [{face, layer, cw, notation}, ...]
  // startState: the logical state to begin from
  const playMoveSequence = useCallback((parsedMoves, startState) => {
    if (sequenceRunRef.current || parsedMoves.length === 0) return;
    sequenceRunRef.current = true;
    setAnimating(true);

    let idx = 0;
    let cur = startState; // local accumulator — no stale closure issue

    const runNext = () => {
      if (idx >= parsedMoves.length) {
        sequenceRunRef.current = false;
        setAnimating(false);
        return;
      }

      const mv = parsedMoves[idx++];
      const duration = speedToDuration(animSpeedRef.current);

      const afterMove = () => {
        cur = applyMove(cur, mv.face, mv.layer, mv.cw);
        updateState(cur);
        setMoveHistory(prev => [...prev, { notation: mv.notation }]);
        runNext();
      };

      if (animateMoveRef.current) {
        animateMoveRef.current(mv.face, mv.layer, mv.cw, duration, afterMove);
      } else {
        afterMove();
      }
    };

    runNext();
  }, []); // no deps — uses refs only

  // ── Scramble (instant — too many moves to animate usefully) ──────────
  const handleScramble = useCallback(() => {
    if (sequenceRunRef.current) return;
    const seq = randomScramble(cubeSize, cubeSize === 2 ? 12 : 20);
    setScrambleMsg(seq);
    updateState(applyMoveSequence(solvedState(cubeSize), seq));
    setMoveHistory([]);
    setCurrentAlgorithm(null);
  }, [cubeSize, updateState]);

  // ── Reset ────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (sequenceRunRef.current) return;
    updateState(solvedState(cubeSize));
    setMoveHistory([]);
    setCurrentAlgorithm(null);
    setHighlightFace(null);
    setScrambleMsg('');
    setCustomInput('');
  }, [cubeSize, updateState]);

  // ── Single move (move buttons) ────────────────────────────────────────
  const applyMoveAnimated = useCallback((face, layer, cw) => {
    if (sequenceRunRef.current) return;
    const notation = `${layer > 0 ? layer + 1 : ''}${face}${cw ? '' : "'"}`;
    const duration = speedToDuration(animSpeedRef.current);

    sequenceRunRef.current = true;
    setAnimating(true);

    const afterMove = () => {
      const next = applyMove(stateRef.current, face, layer, cw);
      updateState(next);
      setMoveHistory(prev => [...prev, { notation }]);
      sequenceRunRef.current = false;
      setAnimating(false);
    };

    if (animateMoveRef.current) {
      animateMoveRef.current(face, layer, cw, duration, afterMove);
    } else {
      afterMove();
    }
  }, []);

  // ── Algorithm stepper animation ──────────────────────────────────────
  // A lightweight hook for AlgorithmPanel: animate one move on the 3D cube
  // without touching sequenceRunRef (the stepper manages its own lock).
  const animateAlgStep = useCallback((face, layer, cw, onDone) => {
    const duration = speedToDuration(animSpeedRef.current);
    if (animateMoveRef.current) {
      animateMoveRef.current(face, layer, cw, duration, onDone);
    } else {
      onDone?.();
    }
  }, []);

  // ── Text input: parse & play animated sequence ────────────────────────
  const handleCustomInput = useCallback(() => {
    if (sequenceRunRef.current) return;
    const raw = customInput.trim();
    if (!raw) return;

    let moves;
    try {
      moves = parseMoveSequence(raw);
    } catch {
      moves = [];
    }

    if (moves.length === 0) {
      setInputError("Invalid notation. Try: R U R' U'");
      return;
    }
    setInputError('');
    // Start from current state (read from ref to avoid stale closure)
    playMoveSequence(moves, stateRef.current);
  }, [customInput, playMoveSequence]);

  // ── Algorithm panel ───────────────────────────────────────────────────
  // Just record the selection — do NOT reset the cube or switch tabs.
  // The AlgorithmPanel's own ⏮/▶ stepper controls the cube state via onStepState.
  const handleAlgorithmSelect = useCallback((alg) => {
    setCurrentAlgorithm(alg);
  }, []);

  const solved = isSolved(state);
  const detectedPattern = useMemo(() => detectPattern(state, cubeSize), [state, cubeSize]);

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <span className="logo">⬡</span>
          <div className="brand-text">
            <h1 className="site-title">Rubik<span className="dot">.</span><span className="grp">Group</span></h1>
          </div>
        </div>
        <div className="header-controls">
          <div className="size-selector">
            {CUBE_SIZES.map(n => (
              <button key={n}
                className={`size-btn ${cubeSize === n ? 'active' : ''}`}
                onClick={() => handleSizeChange(n)}
                title={SIZE_LABELS[n]}
                disabled={animating}
              >{n}×{n}</button>
            ))}
          </div>
          <div className="header-actions">
            <button className="action-btn scramble" onClick={handleScramble} disabled={animating}>
              🔀 Scramble
            </button>
            <button className="action-btn reset" onClick={handleReset} disabled={animating}>
              ↺ Reset
            </button>
          </div>
        </div>
      </header>

      {/* ── Main layout ── */}
      <main className="main-layout">

        {/* ── Left: cube ── */}
        <section className="cube-section">
          {/* Info bar */}
          <div className="cube-info-bar">
            <span className="info-chip">{SIZE_LABELS[cubeSize]}</span>
            <span className="info-chip">{6 * cubeSize * cubeSize} stickers</span>
            <span className="info-chip">|G| ≈ {GROUP_ORDERS[cubeSize]}</span>
            {solved && <span className="info-chip solved-chip">✓ Solved</span>}
          </div>

          {/* 3D viewport + optional side-by-side flat map */}
          <div className={`cube-3d-area${showFlatMap ? ' with-flatmap' : ''}`}>
            <div className="cube-viewport">
              <CubeViewer3D
                state={state}
                size={cubeSize}
                highlightFace={highlightFace}
                animateMoveRef={animateMoveRef}
              />
              <button
                className={`flatmap-toggle ${showFlatMap ? 'active' : ''}`}
                onClick={() => setShowFlatMap(v => !v)}
                title="Toggle 2D net view beside cube"
              >⊞ Net</button>
            </div>

            {showFlatMap && (
              <div className="flatmap-side">
                <div className="flatmap-side-header">
                  <span className="flatmap-side-title">2D Net</span>
                  <span className="flatmap-side-hint">Each face unfolded</span>
                  <button
                    className="flatmap-side-close"
                    onClick={() => setShowFlatMap(false)}
                    title="Close"
                  >✕</button>
                </div>
                <div className="flatmap-side-body">
                  <FlatCubeMap state={state} size={cubeSize} highlightFace={highlightFace} />
                </div>
                <div className="flatmap-side-legend">
                  {['U','R','F','D','L','B'].map(f => (
                    <span key={f} className="fsleg-item">
                      <span className="fsleg-dot" style={{
                        background: ({U:'#fff',R:'#B71234',F:'#009B48',D:'#FFD500',L:'#FF5800',B:'#0046AD'})[f]
                      }} />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Face highlight row */}
          <div className="face-highlight-row">
            <span className="face-hl-label">Highlight:</span>
            {['U','R','F','D','L','B'].map(f => (
              <button key={f}
                className={`face-btn ${highlightFace === f ? 'active' : ''}`}
                onClick={() => setHighlightFace(h => h === f ? null : f)}
              >{f}</button>
            ))}
          </div>

          {/* Notation input + speed control */}
          <div className="move-input-section">
            <div className="move-input-row">
              <input
                className="move-input"
                placeholder="R U R' U' F2 ..."
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !animating && handleCustomInput()}
                disabled={animating}
              />
              <button
                className="apply-btn"
                onClick={handleCustomInput}
                disabled={animating}
              >
                {animating ? '…' : 'Apply'}
              </button>
            </div>
            {inputError && <div className="input-error">{inputError}</div>}

            {/* Speed control */}
            <div className="speed-row">
              <span className="speed-row-label">Speed</span>
              <input
                type="range"
                className="speed-slider-inline"
                min="0.5"
                max="5"
                step="0.5"
                value={animSpeed}
                onChange={e => handleSpeedChange(parseFloat(e.target.value))}
              />
              <span className="speed-row-value">{animSpeed}×</span>
              <span className="speed-row-hint">
                ({speedToDuration(animSpeed)}ms/move)
              </span>
            </div>

            {scrambleMsg && (
              <div className="scramble-display">Scramble: <code>{scrambleMsg}</code></div>
            )}
          </div>
        </section>

        {/* ── Right: tabs ── */}
        <section className="right-section">
          <div className="panel-tabs">
            <button className={`panel-tab ${activeTab === 'guide' ? 'active' : ''}`}
              onClick={() => setActiveTab('guide')} title="Start here — guided walkthrough">📖 Guide</button>
            <button className={`panel-tab ${activeTab === 'moves' ? 'active' : ''}`}
              onClick={() => setActiveTab('moves')}>Moves</button>
            <button className={`panel-tab ${activeTab === 'algorithms' ? 'active' : ''}`}
              onClick={() => setActiveTab('algorithms')}>Algorithms</button>
            <button className={`panel-tab ${activeTab === 'algebra' ? 'active' : ''}`}
              onClick={() => setActiveTab('algebra')}>Group Theory</button>
            <button className={`panel-tab ${activeTab === 'solve' ? 'active' : ''}`}
              onClick={() => setActiveTab('solve')} title="Kociemba two-phase optimal solver">Solve</button>
          </div>

          <div className="panel-content">
            {activeTab === 'guide' && (
              <GuidePanel onNavigate={setActiveTab} />
            )}
            {activeTab === 'moves' && (
              <>
                <div className="moves-intro">
                  <div className="moves-intro-title">How moves connect to math</div>
                  <p className="moves-intro-body">
                    Every button below is a <em>generator</em> of the Rubik's Cube group
                    G — a set of ~43 quintillion reachable permutations. Pressing R rotates
                    the right layer, which acts as a permutation on the 54 stickers. Combining
                    generators like <code>R U R' U'</code> composes permutations, giving you
                    a new group element. Watch the <strong>Group Theory</strong> tab to see
                    the cycle structure update live.
                  </p>
                  <div className="moves-intro-path">
                    <span className="mip-step active">① Moves</span>
                    <span className="mip-arrow">→</span>
                    <span className="mip-step">② Algorithms</span>
                    <span className="mip-arrow">→</span>
                    <span className="mip-step">③ Group Theory</span>
                  </div>
                </div>
                <MoveControls
                  cubeSize={cubeSize}
                  onMove={applyMoveAnimated}
                  disabled={animating}
                />
              </>
            )}
            {activeTab === 'algorithms' && (
              <AlgorithmPanel
                cubeSize={cubeSize}
                onAlgorithmSelect={handleAlgorithmSelect}
                onAlgorithmChange={setCurrentAlgorithm}
                detectedPattern={detectedPattern}
                onAnimateStep={animateAlgStep}
                onStepState={(s, idx) => {
                  // updateState keeps stateRef in sync so playMoveSequence stays correct
                  updateState(s);
                  if (currentAlgorithm) {
                    const toks = currentAlgorithm.notation.trim().split(/\s+/).filter(Boolean);
                    setMoveHistory(
                      idx < 0 ? [] : toks.slice(0, idx + 1).map(n => ({ notation: n }))
                    );
                  }
                }}
                baseState={state}
              />
            )}
            {activeTab === 'algebra' && (
              <AlgebraPanel
                state={state}
                size={cubeSize}
                moveHistory={moveHistory}
                algorithmNote={currentAlgorithm ? {
                  groupTheoryNote: currentAlgorithm.groupTheoryNote,
                  algebraNote: currentAlgorithm.algebraNote,
                  order: currentAlgorithm.order,
                  refs: currentAlgorithm.refs,
                } : null}
              />
            )}
            {activeTab === 'solve' && (
              <SolverPanel
                state={state}
                cubeSize={cubeSize}
                scrambleMsg={scrambleMsg}
                moveHistory={moveHistory}
                animating={animating}
                playMoveSequence={playMoveSequence}
                stateRef={stateRef}
              />
            )}
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <a href="https://en.wikipedia.org/wiki/Rubik%27s_Cube_group" target="_blank" rel="noreferrer">
          Rubik's Cube Group
        </a>
        {' · '}
        <a href="https://cube20.org" target="_blank" rel="noreferrer">God's Number</a>
        {' · '}
        <a href="https://people.math.harvard.edu/~jjchen/docs/Group%20Theory%20and%20the%20Rubik%27s%20Cube.pdf"
           target="_blank" rel="noreferrer">
          Janet Chen — Group Theory and the Rubik's Cube
        </a>
        {' · '}
        <a href="https://en.wikipedia.org/wiki/Metamagical_Themas" target="_blank" rel="noreferrer">
          Hofstadter — Metamagical Themas (1981)
        </a>
      </footer>
    </div>
  );
}
