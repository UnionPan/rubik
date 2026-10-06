import { useState, useCallback, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import FlatCubeMap from './components/FlatCubeMap';
import PlayPanel from './components/PlayPanel';
import TourDialog from './components/TourDialog';
import Segmented from './components/ui/Segmented';
import { ExplainContext, readExplainPreference, writeExplainPreference } from './components/ui/explain';
import GraphSidePanel from './components/GraphSidePanel';
import Splitter from './components/Splitter';
import GenericPlayPanel from './components/GenericPlayPanel';
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
const GraphTheoryPanel = lazy(() => import('./components/GraphTheoryPanel'));
const SolverPanel = lazy(() => import('./components/SolverPanel'));
const GenericGraphsPanel = lazy(() => import('./components/GenericGraphsPanel'));
const GenericSolvePanel = lazy(() => import('./components/GenericSolvePanel'));
import { detectPattern } from './lib/patternRecognition';
import './App.css';


// Right-panel tabs; short labels are used when the panel is narrow
const PANEL_TABS = [
  { id: 'play',       label: 'Play',       short: 'Play',  title: 'Turn the cube' },
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
  const [highlightFace, setHighlightFace]       = useState(null);
  const [sideView, setSideView]                 = useState('graph'); // 'graph' | 'net' | null
  const [customInput, setCustomInput]           = useState('');
  const [inputError, setInputError]             = useState('');
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
  const [activeTab, setActiveTab]               = useState('play');
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
    setHighlightFace(null);
    setScrambleMsg('');
    setCustomInput('');
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

    let idx = 0;
    let cur = startState; // local accumulator — no stale closure issue

    const runNext = () => {
      if (idx >= parsedMoves.length) {
        sequenceRunRef.current = false;
        setAnimating(false);
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
    setHighlightFace(null);
    setScrambleMsg('');
    setCustomInput('');
    setGraphMove(null);
  }, [updateState]);

  // ── Single move (move buttons) ────────────────────────────────────────
  const applyTurnAnimated = useCallback((turn) => {
    if (sequenceRunRef.current) return;
    sequenceRunRef.current = true;
    setAnimating(true);

    runAnimation(turn, () => {
      const next = modelRef.current.applyTurn(stateRef.current, turn);
      updateState(next);
      setMoveHistory(prev => [...prev, turn]);
      sequenceRunRef.current = false;
      setAnimating(false);
    });
  }, [runAnimation, updateState]);
  // Cube move buttons speak (face, layer, cw)
  const applyMoveAnimated = useCallback((face, layer, cw) => {
    const notation = `${layer > 0 ? layer + 1 : ''}${face}${cw ? '' : "'"}`;
    applyTurnAnimated({ face, layers: [layer], cw, notation });
  }, [applyTurnAnimated]);

  // ── Algorithm stepper animation ──────────────────────────────────────
  // A lightweight hook for AlgorithmPanel: animate one move on the cube and
  // graph without touching sequenceRunRef (the stepper manages its own lock).
  const animateAlgStep = runAnimation;

  // ── Text input: parse & play animated sequence ────────────────────────
  const handleCustomInput = useCallback(() => {
    if (sequenceRunRef.current) return;
    const raw = customInput.trim();
    if (!raw) return;

    let moves;
    try {
      moves = model.parseMoveSequence(raw);
    } catch (err) {
      const hint = isCube ? "R U R' U', Rw, M2, x" : `${model.axes.map(a => a.name).join(' ')} and ' for counter-clockwise`;
      setInputError(`${err.message}. Try: ${hint}`);
      return;
    }

    if (moves.length === 0) {
      setInputError("Invalid notation. Try: R U R' U'");
      return;
    }
    setInputError('');
    // Start from current state (read from ref to avoid stale closure)
    playMoveSequence(moves, stateRef.current);
  }, [customInput, model, isCube, playMoveSequence]);

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

  const solved = model.isSolved(state);
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
            {/* Info bar */}
            <div className="cube-info-bar">
              <span className="info-chip">{model.name}</span>
              <span className="info-chip">{model.stickerCount} stickers</span>
              <span className="info-chip">|G| {isCube && model.N > 2 ? '≈' : '='} {model.groupOrder}</span>
              {solved && <span className="info-chip solved-chip">✓ Solved</span>}
            </div>

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
                      highlightFace={highlightFace}
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
                  highlightFace={highlightFace}
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

            {/* Notation input + speed control */}
            <div className="move-input-section">
              <div className="move-input-row">
                <input
                  className="move-input"
                  placeholder={isCube ? "R U R' U' F2 Rw M x ..." : `${model.axes.map(a => a.name).join(' ')} …`}
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
                  disabled={instantTurns}
                  aria-label="Animation speed"
                />
                <span className="speed-row-value">{instantTurns ? 'instant' : `${animSpeed}×`}</span>
                {!instantTurns && (
                  <span className="speed-row-hint">({speedToDuration(animSpeed)}ms/move)</span>
                )}
                {prefersReducedMotion && (
                  <button
                    className="speed-motion-btn"
                    onClick={() => setAnimateAnyway(v => !v)}
                    title="Your system asks for reduced motion, so turns are instant by default"
                  >
                    {animateAnyway ? 'Instant turns' : 'Animate turns'}
                  </button>
                )}
              </div>
              {scrambleMsg && (
                <div className="scramble-display">Scramble: <code>{scrambleMsg}</code></div>
              )}
            </div>
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
                {activeTab === 'play' && (isCube ? (
                  <PlayPanel
                    cubeSize={cubeSize}
                    onMove={applyMoveAnimated}
                    disabled={animating}
                    highlightFace={highlightFace}
                    onHighlightFace={setHighlightFace}
                  />
                ) : (
                  <GenericPlayPanel model={model} onTurn={applyTurnAnimated} disabled={animating} />
                ))}
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
                    {mathView === 'graphs' && (isCube ? (
                      <GraphTheoryPanel
                        state={state}
                        size={cubeSize}
                        moveHistory={moveHistory}
                        focusOrbit={focusOrbit}
                        onFocusOrbit={setFocusOrbit}
                        lastMove={graphMove}
                        graphVisible={sideView === 'graph'}
                        onShowGraph={() => setSideView('graph')}
                      />
                    ) : (
                      <GenericGraphsPanel
                        model={model}
                        state={state}
                        focusOrbit={focusOrbit}
                        onFocusOrbit={setFocusOrbit}
                        graphVisible={sideViewShown === 'graph'}
                        onShowGraph={() => setSideView('graph')}
                        oracle={oracle}
                      />
                    ))}
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
      {tourOpen && (
        <TourDialog
          onClose={() => setTourOpen(false)}
          onFinish={() => { setTourOpen(false); setActiveTab('play'); }}
        />
      )}
    </ExplainContext.Provider>
  );
}
