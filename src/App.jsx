import { useState, useCallback, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import FlatCubeMap from './components/FlatCubeMap';
import TourDialog from './components/TourDialog';
import Segmented from './components/ui/Segmented';
import { ExplainContext, readExplainPreference, writeExplainPreference } from './components/ui/explain';
import GraphSidePanel from './components/GraphSidePanel';
import Splitter from './components/Splitter';
import TurnPad from './components/TurnPad';
import MovesLeft from './components/MovesLeft';
import { getLibrary } from './lib/libraries';
import usePuzzleOracle from './hooks/usePuzzleOracle';
import { encodeShareHash, decodeShareHash } from './lib/share';
import { getModel, PUZZLES } from './lib/puzzles/models';
import { detectGeneric } from './lib/puzzles/detect';

// three.js is most of the bundle: start fetching the 3D viewer right away,
// in parallel with the first render, instead of waiting for React to ask.
const cubeViewerImport = import('./components/CubeViewer3D');
const CubeViewer3D = lazy(() => cubeViewerImport);
const PuzzleViewer3D = lazy(() => import('./components/PuzzleViewer3D'));
// Tabs other than the default Guide load on first use
const AlgebraPanel = lazy(() => import('./components/AlgebraPanel'));
const AlgorithmPanel = lazy(() => import('./components/AlgorithmPanel'));
const GraphsPanel = lazy(() => import('./components/GraphsPanel'));
const SolverPanel = lazy(() => import('./components/SolverPanel'));
const GenericSolvePanel = lazy(() => import('./components/GenericSolvePanel'));
import { detectPattern } from './lib/patternRecognition';
import './App.css';


// Right-panel tabs; short labels are used when the panel is narrow
const PANEL_TABS = [
  { id: 'algorithms', label: 'Algorithms', short: 'Algs',  title: 'Algorithms and the pattern detector' },
  { id: 'math',       label: 'Math',       short: 'Math',  title: 'Group theory and graph theory, live' },
  { id: 'solve',      label: 'Solve',      short: 'Solve', title: 'Two-phase solver' },
];
const MATH_VIEWS = [
  { value: 'groups', label: 'Groups' },
  { value: 'graphs', label: 'Graphs' },
];

// Pane sizes the user dragged to, remembered per browser (best effort)
const LEFT_WIDTH_KEY = 'rubik.leftWidth';
const CUBE_SPLIT_KEY = 'rubik.cubeSplit';
const MIN_LEFT = 420, MIN_RIGHT = 380;      // px, main columns
const MIN_SPLIT = 0.25, MAX_SPLIT = 0.75;   // cube share of the cube/side area

function readStoredNumber(key) {
  try {
    const v = parseFloat(window.localStorage.getItem(key));
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
function writeStoredNumber(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(value));
  } catch {
    // storage unavailable (private mode, blocked) - sizes just won't persist
  }
}
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Animation duration at speed=1: 600ms; at speed=5: 120ms
const speedToDuration = (speed) => Math.round(600 / speed);

/** Position from a shared link (#n=… or #p=…, &s=…&m=…), or null */
function readSharedPosition() {
  const shared = decodeShareHash(window.location.hash);
  if (!shared) return null;
  const model = getModel(shared.puzzleId);
  const state = [...shared.scrambleTurns, ...shared.moves].reduce(model.applyTurn, model.solvedState());
  return { ...shared, state };
}

/** Random turns, for scrambling before a puzzle's full group is enumerated */
function randomTurns(model, count) {
  const turns = [];
  while (turns.length < count) {
    const t = model.allTurns[Math.floor(Math.random() * model.allTurns.length)];
    if (turns.length && turns.at(-1).axis === t.axis) continue;
    turns.push(t);
  }
  return turns.map(t => t.notation).join(' ');
}

export default function App() {
  const [initial] = useState(readSharedPosition);
  const [puzzleId, setPuzzleId]       = useState(initial?.puzzleId ?? 'cube3');
  const model = getModel(puzzleId);
  const isCube = model.kind === 'cube';
  const cubeSize = isCube ? model.N : null;
  const modelRef = useRef(model);
  useEffect(() => { modelRef.current = model; }, [model]);
  const oracle = usePuzzleOracle(isCube ? null : puzzleId);
  const [state, setState]             = useState(() => initial?.state ?? getModel('cube3').solvedState());
  const [moveHistory, setMoveHistory] = useState(initial?.moves ?? []);
  const [currentAlgorithm, setCurrentAlgorithm] = useState(null);
  const [sideView, setSideView]                 = useState('graph'); // 'graph' | 'net' | null
  const [scrambleMsg, setScrambleMsg]           = useState(initial?.scramble ?? '');
  const [scrambleTurns, setScrambleTurns]       = useState(initial?.scrambleTurns ?? []); // turns of the last scramble
  const [shareNote, setShareNote]               = useState('');
  // Respect the system's reduced-motion setting: turns become instant unless the user opts in
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const [animateAnyway, setAnimateAnyway]       = useState(false);
  const instantTurns = prefersReducedMotion && !animateAnyway;
  const instantTurnsRef = useRef(instantTurns);
  useEffect(() => { instantTurnsRef.current = instantTurns; }, [instantTurns]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const onChange = (e) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [activeTab, setActiveTab]               = useState('algorithms');
  const [mathView, setMathView]                 = useState('groups');
  const [tourOpen, setTourOpen]                 = useState(false);
  // Global "Explain" switch: opens or closes every "Why?" section
  const [explain, setExplain] = useState(() => ({ explainAll: readExplainPreference(), version: 0 }));
  const toggleExplain = useCallback(() => {
    setExplain(e => {
      writeExplainPreference(!e.explainAll);
      return { explainAll: !e.explainAll, version: e.version + 1 };
    });
  }, []);
  const [animating, setAnimating]               = useState(false);
  const [longRun, setLongRun]                   = useState(false); // a multi-move sequence is playing
  const [animSpeed, setAnimSpeed]               = useState(2); // 0.5–5x
  const [focusOrbit, setFocusOrbit]             = useState(null);
  const [showOrbits, setShowOrbits]             = useState(false);
  const [graphMove, setGraphMove]               = useState(null);
  const [leftWidth, setLeftWidth]               = useState(() => readStoredNumber(LEFT_WIDTH_KEY)); // px | null
  const [cubeSplit, setCubeSplit]               = useState(() => readStoredNumber(CUBE_SPLIT_KEY)); // 0..1 | null

  useEffect(() => { writeStoredNumber(LEFT_WIDTH_KEY, leftWidth); }, [leftWidth]);
  useEffect(() => { writeStoredNumber(CUBE_SPLIT_KEY, cubeSplit); }, [cubeSplit]);

  // ── Draggable pane splitters ──────────────────────────────────────────
  const mainRef        = useRef(null);
  const cubeSectionRef = useRef(null);
  const cubeAreaRef    = useRef(null);
  const viewportRef    = useRef(null);

  const resizeLeftTo = useCallback((clientX) => {
    const box = mainRef.current?.getBoundingClientRect();
    if (!box) return;
    setLeftWidth(Math.round(clamp(clientX - box.left, MIN_LEFT, box.width - MIN_RIGHT)));
  }, []);
  const nudgeLeft = useCallback((dx) => {
    const edge = cubeSectionRef.current?.getBoundingClientRect().right;
    if (edge != null) resizeLeftTo(edge + dx);
  }, [resizeLeftTo]);

  const resizeSplitTo = useCallback((clientX) => {
    const box = cubeAreaRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setCubeSplit(clamp((clientX - box.left) / box.width, MIN_SPLIT, MAX_SPLIT));
  }, []);
  const nudgeSplit = useCallback((dx) => {
    const edge = viewportRef.current?.getBoundingClientRect().right;
    if (edge != null) resizeSplitTo(edge + dx);
  }, [resizeSplitTo]);

  // The 3D viewer sets cubeAnimRef.current = animate(turn, ms, onComplete, start)
  // FaceletGraph sets graphAnimRef.current = animate(turn, ms, start)
  const cubeAnimRef  = useRef(null);
  const graphAnimRef = useRef(null);

  // Keep speed in a ref so the closure inside playMoveSequence always sees current value
  const animSpeedRef   = useRef(animSpeed);
  const sequenceRunRef = useRef(false); // true while a sequence is playing
  const turnQueueRef   = useRef([]);    // single turns waiting to play (keys, swipes)
  // Keep current state in a ref so playMoveSequence can read it without stale closure
  const stateRef = useRef(state);
  const updateState = useCallback((s) => {
    setState(s);
    stateRef.current = s;
  }, []);

  const handleSpeedChange = useCallback((v) => {
    setAnimSpeed(v);
    animSpeedRef.current = v;
  }, []);

  // ── One turn, animated in lockstep on the 3D puzzle and the graph ──
  // Both views get the same start timestamp and duration and use the same
  // easing, so every frame shows the same fraction of the turn.
  // turn: a cube turn { face, layers, cw, notation } or a puzzle turn { axis, cw, notation }
  const runAnimation = useCallback((turn, onDone) => {
    const duration = instantTurnsRef.current ? 0 : speedToDuration(animSpeedRef.current);
    const start = performance.now();
    graphAnimRef.current?.(turn, duration, start);
    if (cubeAnimRef.current) {
      cubeAnimRef.current(turn, duration, onDone, start);
    } else {
      onDone?.();
    }
  }, []);

  // ── Puzzle change ────────────────────────────────────────────────────
  const handlePuzzleChange = useCallback((id) => {
    if (sequenceRunRef.current) return; // don't switch mid-sequence
    const next = getModel(id);
    const newState = next.solvedState();
    turnQueueRef.current = [];
    modelRef.current = next;
    setPuzzleId(id);
    setState(newState);
    stateRef.current = newState; // keep ref in sync so first move after resize uses correct state
    setMoveHistory([]);
    setScrambleTurns([]);
    setCurrentAlgorithm(null);
    setScrambleMsg('');
    setFocusOrbit(null);
    setGraphMove(null);
  }, []);

  // ── Play an array of parsed moves sequentially, each with animation ──
  // parsedMoves: turns from model.parseMoveSequence
  // startState: the logical state to begin from
  const playMoveSequence = useCallback((parsedMoves, startState) => {
    if (sequenceRunRef.current || parsedMoves.length === 0) return;
    sequenceRunRef.current = true;
    setAnimating(true);
    setLongRun(parsedMoves.length > 1);

    let idx = 0;
    let cur = startState; // local accumulator — no stale closure issue

    const runNext = () => {
      if (idx >= parsedMoves.length) {
        sequenceRunRef.current = false;
        setAnimating(false);
        setLongRun(false);
        drainTurnQueueRef.current?.(); // keys pressed meanwhile play next
        return;
      }

      const mv = parsedMoves[idx++];

      runAnimation(mv, () => {
        cur = modelRef.current.applyTurn(cur, mv);
        updateState(cur);
        setMoveHistory(prev => [...prev, mv]);
        runNext();
      });
    };

    runNext();
  }, [runAnimation, updateState]);

  // ── Queued single turns (keyboard, swipes on the cube) ────────────────
  // Fast input is queued instead of dropped; the queue is short so a held key
  // cannot run away.  (turnQueueRef is declared with the other refs above.)
  const drainTurnQueueRef = useRef(null);
  const drainTurnQueue = useCallback(() => {
    if (sequenceRunRef.current) return;
    const next = turnQueueRef.current.shift();
    if (next) playMoveSequence([next], stateRef.current);
  }, [playMoveSequence]);
  useEffect(() => { drainTurnQueueRef.current = drainTurnQueue; }, [drainTurnQueue]);
  const enqueueTurn = useCallback((turn) => {
    if (turnQueueRef.current.length >= 8) return;
    turnQueueRef.current.push(turn);
    drainTurnQueue();
  }, [drainTurnQueue]);

  // ── Scramble (instant — too many moves to animate usefully) ──────────
  const applyScramble = useCallback((m, seq) => {
    const turns = m.parseMoveSequence(seq);
    setScrambleMsg(seq);
    setScrambleTurns(turns);
    updateState(turns.reduce(m.applyTurn, m.solvedState()));
    setMoveHistory([]);
    setCurrentAlgorithm(null);
    setGraphMove(null);
  }, [updateState]);
  const handleScramble = useCallback(async () => {
    if (sequenceRunRef.current) return;
    turnQueueRef.current = [];
    const m = modelRef.current;
    if (m.kind === 'cube') { applyScramble(m, m.randomScramble()); return; }
    // Random-state scramble once the whole group is enumerated, random turns before that
    const answer = oracle.info ? await oracle.scramble() : null;
    if (modelRef.current !== m) return; // puzzle switched while waiting
    applyScramble(m, answer?.scramble || randomTurns(m, 12));
  }, [applyScramble, oracle]);

  // ── Reset ────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (sequenceRunRef.current) return;
    turnQueueRef.current = [];
    updateState(modelRef.current.solvedState());
    setMoveHistory([]);
    setScrambleTurns([]);
    setCurrentAlgorithm(null);
    setScrambleMsg('');
    setGraphMove(null);
  }, [updateState]);

  // ── Algorithm stepper animation ──────────────────────────────────────
  // A lightweight hook for AlgorithmPanel: animate one move on the cube and
  // graph without touching sequenceRunRef (the stepper manages its own lock).
  const animateAlgStep = runAnimation;

  // ── Algorithm stepper history ─────────────────────────────────────────
  // The stepper reports turns relative to the state it started from; the
  // history before that point is kept, so the path since solved stays exact.
  const moveHistoryRef = useRef(moveHistory);
  useEffect(() => { moveHistoryRef.current = moveHistory; }, [moveHistory]);
  const algEntryHistoryRef = useRef([]);
  const handleAlgEntry = useCallback(() => {
    algEntryHistoryRef.current = moveHistoryRef.current;
  }, []);
  const handleAlgStepState = useCallback((s, turns) => {
    updateState(s); // keeps stateRef in sync so playMoveSequence stays correct
    setMoveHistory([...algEntryHistoryRef.current, ...turns]);
  }, [updateState]);

  // Every quarter turn since the last solved state: scramble, then moves
  const solvePath = useMemo(() => [...scrambleTurns, ...moveHistory], [scrambleTurns, moveHistory]);

  // ── Keyboard turning ──────────────────────────────────────────────────
  //   R U F D L B  face turns      Shift = counter-clockwise (')
  //   Alt/Option   wide (Rw…)      M E S slices, X Y Z whole-cube rotations
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.repeat) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"], [role="separator"]')) return;
      const letter = /^Key([A-Z])$/.exec(e.code)?.[1]; // e.code: layout-independent, works with Option
      if (!letter) return;
      if (model.kind !== 'cube') {
        // Other puzzles: one key per turning axis
        if (!model.axes.some(a => a.name === letter)) return;
        e.preventDefault();
        enqueueTurn(model.parseMoveSequence(letter + (e.shiftKey ? "'" : ''))[0]);
        return;
      }
      if (!'RUFDLBMESXYZ'.includes(letter)) return;
      const N = model.N;
      let token;
      if ('XYZ'.includes(letter)) token = letter.toLowerCase();
      else if ('MES'.includes(letter)) { if (N < 3) return; token = letter; }
      else token = e.altKey && N >= 3 ? `${letter}w` : letter;
      e.preventDefault();
      const [turn] = model.parseMoveSequence(token + (e.shiftKey ? "'" : ''));
      enqueueTurn({ ...turn, notation: model.turnToNotation(turn) });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [model, enqueueTurn]);

  // ── Shareable link: the URL fragment always describes the position ─────
  useEffect(() => {
    const hash = encodeShareHash({ model, scramble: scrambleMsg, moves: moveHistory });
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    // replaceState: playing moves should not flood the back button
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
      window.history.replaceState(null, '', url);
    }
  }, [model, scrambleMsg, moveHistory]);

  // A link pasted into this tab (hashchange) loads that position
  useEffect(() => {
    const onHashChange = () => {
      const shared = readSharedPosition();
      if (!shared || sequenceRunRef.current) return;
      modelRef.current = getModel(shared.puzzleId);
      setPuzzleId(shared.puzzleId);
      updateState(shared.state);
      setScrambleMsg(shared.scramble);
      setScrambleTurns(shared.scrambleTurns);
      setMoveHistory(shared.moves);
      setCurrentAlgorithm(null);
      setGraphMove(null);
      setFocusOrbit(null);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [updateState]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareNote('Link copied');
    } catch {
      setShareNote('Copy the link from the address bar');
    }
    setTimeout(() => setShareNote(''), 2200);
  }, []);

  // ── Pattern detector: play a setup turn it suggests (e.g. "U'") ────────
  const handleApplySetup = useCallback((notation) => {
    if (sequenceRunRef.current) return;
    playMoveSequence(modelRef.current.parseMoveSequence(notation), stateRef.current);
  }, [playMoveSequence]);

  // ── Algorithm panel ───────────────────────────────────────────────────
  // Just record the selection — do NOT reset the cube or switch tabs.
  // The AlgorithmPanel's own ⏮/▶ stepper controls the cube state via onStepState.
  const handleAlgorithmSelect = useCallback((alg) => {
    setCurrentAlgorithm(alg);
  }, []);

  const detectedPattern = useMemo(
    () => (isCube ? detectPattern(state, cubeSize) : detectGeneric(model, state)),
    [state, isCube, cubeSize, model],
  );
  const sideViewShown = !isCube && sideView === 'net' ? 'graph' : sideView; // no net for other puzzles

  return (
    <ExplainContext.Provider value={explain}>
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
            <div className="size-selector" role="group" aria-label="Puzzle">
              {PUZZLES.map(p => (
                <button key={p.id}
                  className={`size-btn${puzzleId === p.id ? ' active' : ''}${p.id.startsWith('cube') ? '' : ' size-btn-named'}`}
                  onClick={() => handlePuzzleChange(p.id)}
                  title={p.name}
                  aria-pressed={puzzleId === p.id}
                  disabled={animating}
                >{p.label}</button>
              ))}
            </div>
            <div className="header-actions">
              <button className="action-btn scramble" onClick={handleScramble} disabled={animating}>
                🔀 Scramble
              </button>
              <button className="action-btn reset" onClick={handleReset} disabled={animating}>
                ↺ Reset
              </button>
              <button
                className="action-btn tour"
                onClick={() => setTourOpen(true)}
                title="A five-step guided tour of the math"
              >
                ? Tour
              </button>
              <button
                className="action-btn share"
                onClick={handleShare}
                title="Copy a link to this exact position (puzzle, scramble and moves)"
              >
                🔗 Share
              </button>
              {shareNote && <span className="share-note" role="status">{shareNote}</span>}
            </div>
          </div>
        </header>

        {/* ── Main layout ── */}
        <main
          ref={mainRef}
          className={`main-layout${sideViewShown === 'graph' ? ' graph-open' : ''}${leftWidth != null ? ' custom-split' : ''}`}
          style={leftWidth != null ? { '--left-w': `${leftWidth}px` } : undefined}
        >

          {/* ── Left: cube ── */}
          <section className="cube-section" ref={cubeSectionRef}>
            {/* 3D viewport + optional side-by-side flat map */}
            <div
              ref={cubeAreaRef}
              className={`cube-3d-area${sideViewShown ? ` with-side with-${sideViewShown}` : ''}`}
            >
              <div
                className="cube-viewport"
                ref={viewportRef}
                style={sideViewShown && cubeSplit != null ? { flex: `0 0 ${cubeSplit * 100}%` } : undefined}
              >
                <Suspense fallback={<div className="cube-loading" role="status">Loading 3D puzzle…</div>}>
                  {isCube ? (
                    <CubeViewer3D
                      state={state}
                      size={cubeSize}
                      animateMoveRef={cubeAnimRef}
                      onTurn={enqueueTurn}
                    />
                  ) : (
                    <PuzzleViewer3D
                      key={puzzleId}
                      puzzle={model}
                      state={state}
                      animateMoveRef={cubeAnimRef}
                      onTurn={enqueueTurn}
                    />
                  )}
                </Suspense>
                <div className="side-view-toggles" role="group" aria-label="Second view beside the cube">
                  <button
                    className={`flatmap-toggle ${sideViewShown === 'graph' ? 'active' : ''}`}
                    onClick={() => setSideView(sideViewShown === 'graph' ? null : 'graph')}
                    title="Facelet graph beside the puzzle, animated in sync"
                    aria-pressed={sideViewShown === 'graph'}
                  >◎ Graph</button>
                  {isCube && (
                    <button
                      className={`flatmap-toggle ${sideView === 'net' ? 'active' : ''}`}
                      onClick={() => setSideView(v => v === 'net' ? null : 'net')}
                      title="2D net beside the cube"
                      aria-pressed={sideView === 'net'}
                    >⊞ Net</button>
                  )}
                </div>
              </div>

              {sideViewShown && (
                <Splitter
                  label="Resize cube and side view"
                  valueNow={cubeSplit != null ? cubeSplit * 100 : undefined}
                  onDrag={resizeSplitTo}
                  onStep={nudgeSplit}
                  onReset={() => setCubeSplit(null)}
                />
              )}

              {sideViewShown === 'graph' && (
                <GraphSidePanel
                  key={puzzleId}
                  graph={model.graph}
                  state={state}
                  animateRef={graphAnimRef}
                  focusOrbit={focusOrbit}
                  onFocusOrbit={setFocusOrbit}
                  showOrbits={showOrbits}
                  onShowOrbits={setShowOrbits}
                  move={graphMove}
                  onMoveChange={setGraphMove}
                  onClose={() => setSideView(null)}
                  onExplain={() => { setActiveTab('math'); setMathView('graphs'); }}
                />
              )}

              {sideViewShown === 'net' && (
                <div className="flatmap-side">
                  <div className="flatmap-side-header">
                    <span className="flatmap-side-title">2D Net</span>
                    <span className="flatmap-side-hint">Each face unfolded</span>
                    <button
                      className="flatmap-side-close"
                      onClick={() => setSideView(null)}
                      title="Close"
                    >✕</button>
                  </div>
                  <div className="flatmap-side-body">
                    <FlatCubeMap state={state} size={cubeSize} />
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

            <TurnPad
              key={puzzleId}
              model={model}
              onTurn={enqueueTurn}
              disabled={longRun}
              speed={animSpeed}
              onSpeedChange={handleSpeedChange}
              instantTurns={instantTurns}
              prefersReducedMotion={prefersReducedMotion}
              animateAnyway={animateAnyway}
              onToggleAnimate={() => setAnimateAnyway(v => !v)}
            />
          </section>

          <Splitter
            label="Resize cube column and panel"
            valueNow={leftWidth != null && mainRef.current ? (leftWidth / mainRef.current.clientWidth) * 100 : undefined}
            onDrag={resizeLeftTo}
            onStep={nudgeLeft}
            onReset={() => setLeftWidth(null)}
          />

          {/* ── Right: tabs ── */}
          <section className="right-section">
            <div className="panel-tabs">
              {PANEL_TABS.map(t => (
                <button key={t.id}
                  className={`panel-tab ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                  title={t.title}
                  aria-label={t.label}
                >
                  <span className="tab-full">{t.label}</span>
                  <span className="tab-short" aria-hidden="true">{t.short}</span>
                </button>
              ))}
              <button
                className={`explain-switch${explain.explainAll ? ' on' : ''}`}
                role="switch"
                aria-checked={explain.explainAll}
                onClick={toggleExplain}
                title="Open or close every explanation"
              >
                <span className="explain-track" aria-hidden="true"><span className="explain-thumb" /></span>
                Explain
              </button>
            </div>

            <div className="panel-content">
              <Suspense fallback={<div className="panel-loading" role="status">Loading…</div>}>
                {activeTab === 'algorithms' && (
                  <AlgorithmPanel
                    key={puzzleId}
                    model={model}
                    library={getLibrary(model)}
                    detectorExtra={isCube ? null : (
                      <MovesLeft oracle={oracle} state={state} disabled={animating} onPlay={handleApplySetup} />
                    )}
                    onAlgorithmSelect={handleAlgorithmSelect}
                    onAlgorithmChange={setCurrentAlgorithm}
                    detectedPattern={detectedPattern}
                    onAnimateStep={animateAlgStep}
                    onApplySetup={handleApplySetup}
                    onStepState={handleAlgStepState}
                    onEntry={handleAlgEntry}
                    baseState={state}
                  />
                )}
                {activeTab === 'math' && (
                  <>
                    <div className="panel-subnav">
                      <Segmented options={MATH_VIEWS} value={mathView} onChange={setMathView} label="Math view" />
                    </div>
                    {mathView === 'groups' && (
                      <AlgebraPanel
                        model={model}
                        state={state}
                        moveHistory={moveHistory}
                        solvePath={solvePath}
                        algorithm={isCube ? currentAlgorithm : null}
                        godsNumber={oracle.info?.godsNumber ?? null}
                      />
                    )}
                    {mathView === 'graphs' && (
                      <GraphsPanel
                        model={model}
                        state={state}
                        lastMove={graphMove}
                        focusOrbit={focusOrbit}
                        onFocusOrbit={setFocusOrbit}
                        graphVisible={sideViewShown === 'graph'}
                        onShowGraph={() => setSideView('graph')}
                        onTurn={enqueueTurn}
                        oracle={isCube ? null : oracle}
                      />
                    )}
                  </>
                )}
                {activeTab === 'solve' && (isCube ? (
                  <SolverPanel
                    state={state}
                    cubeSize={cubeSize}
                    animating={animating}
                    playMoveSequence={playMoveSequence}
                    stateRef={stateRef}
                    detectedPattern={detectedPattern}
                  />
                ) : (
                  <GenericSolvePanel
                    model={model}
                    state={state}
                    oracle={oracle}
                    animating={animating}
                    playMoveSequence={playMoveSequence}
                    stateRef={stateRef}
                  />
                ))}
              </Suspense>
            </div>
          </section>
        </main>

      </div>
      {tourOpen && (
        <TourDialog
          onClose={() => setTourOpen(false)}
          onFinish={() => { setTourOpen(false); setActiveTab('algorithms'); }}
        />
      )}
    </ExplainContext.Provider>
  );
}
