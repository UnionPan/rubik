import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { parseMoveSequence, isSolved } from '../lib/cubeState';

// ── Phase 2 move set: only these are allowed in H = <U, D, R2, L2, F2, B2> ──
const PHASE2_SET = new Set(['U', "U'", 'U2', 'D', "D'", 'D2', 'R2', 'L2', 'F2', 'B2']);

/**
 * Detect where Phase 1 ends and Phase 2 begins.
 * Phase 2 is the longest trailing suffix of the solution where every move
 * is a Phase-2 move. Phase 1 is everything before that suffix.
 *
 * This heuristic is exact in all practical Kociemba outputs because the
 * two-phase algorithm is designed so that Phase 2 never needs Phase-1-only moves.
 */
function splitPhases(tokens) {
  let p2Start = tokens.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (PHASE2_SET.has(tokens[i])) p2Start = i;
    else break;
  }
  return { p1: tokens.slice(0, p2Start), p2: tokens.slice(p2Start) };
}

/** True for a move that can only occur in Phase 1 (quarter turns of R/L/F/B) */
function isPhase1Only(tok) { return !PHASE2_SET.has(tok); }

/**
 * SolverPanel
 * Props:
 *   state          — current 6×N×N cube state
 *   cubeSize       — N (solver only supports 3)
 *   scrambleMsg    — initial scramble string
 *   moveHistory    — [{notation}, ...] subsequent manual moves
 *   animating      — true while a sequence plays
 *   playMoveSequence(moves, startState) — animates a move array
 *   stateRef       — always-current state ref
 */
export default function SolverPanel({
  state,
  cubeSize,
  scrambleMsg,
  moveHistory,
  animating,
  playMoveSequence,
  stateRef,
}) {
  const [workerReady, setWorkerReady] = useState(false);
  const [solving, setSolving]         = useState(false);
  const [solution, setSolution]       = useState(null);
  const [solveMoves, setSolveMoves]   = useState(null);
  const [solveError, setSolveError]   = useState(null);
  const [activeStep, setActiveStep]   = useState(-1); // eslint-disable-line no-unused-vars
  const workerRef = useRef(null);
  const reqIdRef  = useRef(0);

  // ── Worker lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    if (cubeSize !== 3 && cubeSize !== 2) return;
    const worker = new Worker(
      new URL('../lib/solver.worker.js', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      const { type, id, solution: sol, error: err } = e.data;
      if (type === 'ready') { setWorkerReady(true); return; }
      if (id !== reqIdRef.current) return;
      setSolving(false);
      if (err) {
        setSolveError(`Solver error: ${err}`);
        setSolution(null); setSolveMoves(null);
      } else {
        setSolution(sol); setSolveError(null);
        try { setSolveMoves(sol ? parseMoveSequence(sol) : []); }
        catch { setSolveMoves(null); }
      }
    };
    worker.onerror = (e) => {
      setSolving(false);
      setSolveError('Worker crashed: ' + (e.message || 'unknown'));
    };
    workerRef.current = worker;
    return () => { worker.terminate(); workerRef.current = null; setWorkerReady(false); };
  }, [cubeSize]);

  const buildScramble = useCallback(() =>
    [scrambleMsg, ...moveHistory.map(m => m.notation)]
      .filter(Boolean).join(' ').trim(),
    [scrambleMsg, moveHistory]);

  // Reset solution when cube state changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSolution(null); setSolveMoves(null);
    setSolveError(null); setActiveStep(-1);
  }, [state]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSolve = useCallback(() => {
    if (!workerRef.current || !workerReady || solving || animating) return;
    const scramble = buildScramble();
    setSolution(null); setSolveMoves(null);
    setSolveError(null); setSolving(true); setActiveStep(-1);
    reqIdRef.current += 1;
    workerRef.current.postMessage({ scramble, id: reqIdRef.current });
  }, [workerReady, solving, animating, buildScramble]);

  // Animated play with per-move step highlighting
  const handlePlay = useCallback(() => {
    if (!solveMoves || solveMoves.length === 0 || animating) return;
    playMoveSequence(solveMoves, stateRef.current);
  }, [solveMoves, animating, playMoveSequence, stateRef]);

  // ── Parse phases from solution ────────────────────────────────────────
  const phases = useMemo(() => {
    if (!solution) return null;
    const tokens = solution.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { tokens: [], p1: [], p2: [] };
    return { tokens, ...splitPhases(tokens) };
  }, [solution]);

  if (cubeSize === 4 || cubeSize === 5) {
    return <ReductionMethodPanel cubeSize={cubeSize} />;
  }

  // 2×2 uses the same Kociemba worker as 3×3:
  // All 2×2 moves are outer-face moves (R, U, F, D, L, B) — a subset of valid 3×3 moves.
  // The virtual 3×3's edges/centers start solved; Kociemba only needs to fix the corners.

  const cubeIsSolved = isSolved(state);
  const scramble     = buildScramble();

  return (
    <div className="solver-panel">
      <h3 className="panel-title">
        <span className="icon">★</span> Kociemba Solver
        {cubeSize === 2 && <span className="solver-size-note"> — 2×2 via corner-equivalence</span>}
      </h3>

      {/* ── Worker status ── */}
      <div className={`solver-status-bar ${workerReady ? 'ready' : 'loading'}`}>
        {workerReady
          ? <><span className="ssb-dot green"/>Solver ready</>
          : <><span className="ssb-dot spin"/>Initializing Kociemba tables…</>}
      </div>

      {/* ── Solve button ── */}
      <button
        className={`solver-solve-btn ${solving ? 'solving' : ''}`}
        onClick={handleSolve}
        disabled={!workerReady || solving || animating || cubeIsSolved || !scramble}
        title={
          !workerReady     ? 'Initializing…'
          : cubeIsSolved   ? 'Cube is already solved'
          : !scramble      ? 'Apply moves or scramble first'
          : solving        ? 'Searching…'
          : 'Run two-phase solver'
        }
      >
        {solving
          ? <><span className="btn-spin">⏳</span> Solving…</>
          : cubeIsSolved ? '✓ Already solved'
          : '★ Find solution'}
      </button>

      {/* ── Error ── */}
      {solveError && <div className="solver-error">{solveError}</div>}

      {/* ── Solution result with phase visualisation ── */}
      {solution !== null && !solveError && phases && (
        <SolutionDisplay
          phases={phases}
          animating={animating}
          onPlay={handlePlay}
          cubeIsSolved={cubeIsSolved}
        />
      )}

      {/* ── Algorithm diagram: the two-phase picture ── */}
      <TwoPhaseSearchDiagram />

      {/* ── H-subgroup visual ── */}
      <HSubgroupDiagram />

      {/* ── Coordinate space ── */}
      <CoordinateSpaceDiagram />
    </div>
  );
}

// ── Solution display with Phase 1 / Phase 2 split ─────────────────────────────

function SolutionDisplay({ phases, animating, onPlay, cubeIsSolved }) {
  const { tokens, p1, p2 } = phases;
  if (tokens.length === 0) {
    return (
      <div className="solver-result">
        <div className="solver-result-solved">✓ No moves needed — cube is already solved.</div>
      </div>
    );
  }
  return (
    <div className="solver-result">
      <div className="solver-result-header">
        <span className="srh-label">Solution</span>
        <span className="srh-count">{tokens.length} moves total</span>
      </div>

      {/* Phase 1 block */}
      {p1.length > 0 && (
        <div className="phase-block phase1">
          <div className="phase-block-label">
            <span className="phase-badge p1">Phase 1</span>
            <span className="phase-desc">reach H in {p1.length} move{p1.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="phase-moves">
            {p1.map((tok, i) => (
              <span key={i} className={`solver-move-token p1 ${isPhase1Only(tok) ? 'p1-only' : ''}`}>
                {tok}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Phase 2 block */}
      {p2.length > 0 && (
        <div className="phase-block phase2">
          <div className="phase-block-label">
            <span className="phase-badge p2">Phase 2</span>
            <span className="phase-desc">solve within H in {p2.length} move{p2.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="phase-moves">
            {p2.map((tok, i) => (
              <span key={i} className="solver-move-token p2">{tok}</span>
            ))}
          </div>
        </div>
      )}

      {/* Phase 1-only marker legend */}
      <div className="phase-legend">
        <span className="solver-move-token p1 p1-only" style={{fontSize:'0.6rem',padding:'1px 5px'}}>R</span>
        <span className="pl-text">= quarter turn of F/B/R/L — Phase 1 only</span>
        <span className="solver-move-token p2" style={{fontSize:'0.6rem',padding:'1px 5px',marginLeft:8}}>R2</span>
        <span className="pl-text">= half turn — allowed in Phase 2</span>
      </div>

      <button
        className="solver-play-btn"
        onClick={onPlay}
        disabled={animating || cubeIsSolved}
      >
        {animating ? '⏸ Playing…' : '▶ Animate solution'}
      </button>
    </div>
  );
}

// ── Two-phase IDA* search diagram ─────────────────────────────────────────────

function TwoPhaseSearchDiagram() {
  return (
    <div className="solver-diagram-card">
      <div className="sdc-title">Two-Phase IDA* Search</div>
      <svg viewBox="0 0 360 220" className="sdc-svg" aria-label="Two-phase IDA* search diagram">

        {/* ── Axes ── */}
        {/* State space blob: full cube group */}
        <ellipse cx="180" cy="110" rx="168" ry="96"
          fill="none" stroke="#3a3228" strokeWidth="1.2"/>
        <text x="8" y="18" fontSize="8.5" fill="#5a5040">Full cube group G</text>
        <text x="8" y="29" fontSize="7" fill="#3a3228">≈ 4.3 × 10¹⁹ states</text>

        {/* H subgroup blob */}
        <ellipse cx="265" cy="130" rx="82" ry="58"
          fill="rgba(0,75,173,0.08)" stroke="#0046AD" strokeWidth="1" strokeDasharray="4 3"/>
        <text x="248" y="100" fontSize="7.5" fill="#0046AD" fontWeight="bold">H</text>
        <text x="226" y="111" fontSize="6.5" fill="#0046AD">663,552 states</text>
        <text x="229" y="122" fontSize="6" fill="#4060a0">U,D,R²,L²,F²,B²</text>

        {/* Solved state dot */}
        <circle cx="280" cy="148" r="5" fill="#009B48"/>
        <text x="288" y="151" fontSize="7" fill="#009B48" fontWeight="bold">solved</text>

        {/* Scrambled state dot */}
        <circle cx="62" cy="80" r="5" fill="#B71234"/>
        <text x="70" y="77" fontSize="7" fill="#B71234" fontWeight="bold">scrambled</text>

        {/* Phase 1 arrow: scrambled → into H */}
        <defs>
          <marker id="arr1" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" fill="#FF5800"/>
          </marker>
          <marker id="arr2" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" fill="#0046AD"/>
          </marker>
        </defs>
        {/* Phase 1 curved path */}
        <path d="M 67,80 Q 130,50 190,105"
          fill="none" stroke="#FF5800" strokeWidth="1.8" markerEnd="url(#arr1)" strokeDasharray="5 3"/>
        {/* Phase 2 curved path */}
        <path d="M 192,108 Q 230,115 274,144"
          fill="none" stroke="#0046AD" strokeWidth="1.8" markerEnd="url(#arr2)"/>

        {/* Phase 1 label on path */}
        <text x="105" y="55" fontSize="8" fill="#FF5800" fontWeight="bold">Phase 1</text>
        <text x="101" y="65" fontSize="6.5" fill="#FF5800">IDA* on flip/twist/slice</text>
        <text x="103" y="74" fontSize="6.5" fill="#FF5800">→ enters H in ≤12 moves</text>

        {/* Phase 2 label on path */}
        <text x="208" y="107" fontSize="8" fill="#0046AD" fontWeight="bold">Phase 2</text>
        <text x="204" y="117" fontSize="6.5" fill="#0046AD">IDA* within H</text>
        <text x="204" y="126" fontSize="6.5" fill="#0046AD">→ solved in ≤18 moves</text>

        {/* H boundary dot (where phase 1 lands) */}
        <circle cx="192" cy="107" r="4" fill="#FFD500" stroke="#FF5800" strokeWidth="1"/>
        <text x="178" y="100" fontSize="6.5" fill="#FFD500">entry to H</text>
      </svg>
      <div className="sdc-note">
        Phase 1 reaches the subgroup H = &lt;U, D, R², L², F², B²&gt; using all 18 generators.
        Phase 2 solves within H using only its 10 generators — guaranteeing ≤20 total moves.
      </div>
    </div>
  );
}

// ── H subgroup visual: which face turns are Phase 2 generators ────────────────
// Shows a cube net with U/D/R/L/F/B faces coloured by their Phase 2 status.

const FACE_HEX  = ['#FFFFFF','#B71234','#009B48','#FFD500','#FF5800','#0046AD'];
const FACE_NAMES_ORDER = ['U','R','F','D','L','B'];
// Phase 2 generators per face:
//   U → U, U', U2  ✓
//   D → D, D', D2  ✓
//   R → R2 only    (quarter turns banned)
//   L → L2 only
//   F → F2 only
//   B → B2 only
const PHASE2_GENS = {
  U: ['U','U2',"U'"],
  D: ['D','D2',"D'"],
  R: ['R2'],
  L: ['L2'],
  F: ['F2'],
  B: ['B2'],
};
const FULL_QUARTER = { U: true, D: true, R: false, L: false, F: false, B: false };

function HSubgroupDiagram() {
  // Net layout (in 60px cells): row, col positions of U R F D L B
  const layout = [
    { name:'U', row:0, col:1, colorIdx:0 },
    { name:'L', row:1, col:0, colorIdx:4 },
    { name:'F', row:1, col:1, colorIdx:2 },
    { name:'R', row:1, col:2, colorIdx:1 },
    { name:'B', row:1, col:3, colorIdx:5 },
    { name:'D', row:2, col:1, colorIdx:3 },
  ];
  const cell = 56, gap = 2;
  const W = 4 * (cell + gap), H = 3 * (cell + gap);

  return (
    <div className="solver-diagram-card">
      <div className="sdc-title">Subgroup H — Phase 2 Generator Restrictions</div>
      <div className="hsg-layout">
        <svg viewBox={`0 0 ${W} ${H}`} className="hsg-svg"
          aria-label="Cube net showing Phase 2 move restrictions">
          {layout.map(({ name, row, col, colorIdx }) => {
            const x = col * (cell + gap), y = row * (cell + gap);
            const quarterOk = FULL_QUARTER[name];
            const gens = PHASE2_GENS[name];
            const fc = FACE_HEX[colorIdx];
            return (
              <g key={name}>
                {/* Face square */}
                <rect x={x} y={y} width={cell} height={cell} rx="4"
                  fill={fc}
                  stroke={quarterOk ? '#6ee7b7' : '#FFD500'}
                  strokeWidth="2.5"/>
                {/* Face letter */}
                <text x={x + cell/2} y={y + cell/2 - 8} textAnchor="middle"
                  fontSize="15" fontWeight="800"
                  fill={colorIdx === 0 ? '#222' : '#fff'}
                  style={{textShadow: colorIdx===0 ? 'none' : '0 1px 2px #0004'}}>
                  {name}
                </text>
                {/* Generators for this face */}
                <text x={x + cell/2} y={y + cell/2 + 7} textAnchor="middle"
                  fontSize="9" fontWeight="600"
                  fill={colorIdx === 0 ? '#444' : 'rgba(255,255,255,0.9)'}>
                  {gens.join(' ')}
                </text>
                {/* Phase badge */}
                <rect x={x+3} y={y+3} width={quarterOk ? 16 : 14} height={10} rx="3"
                  fill={quarterOk ? 'rgba(110,231,183,0.9)' : 'rgba(255,215,0,0.9)'}/>
                <text x={x+5} y={y+11} fontSize="6.5" fontWeight="700"
                  fill={quarterOk ? '#065f46' : '#78350f'}>
                  {quarterOk ? 'Q+H' : 'H½'}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="hsg-legend">
          <div className="hsg-legend-item">
            <span className="hsg-badge green">Q+H</span>
            <span>U and D — quarter <em>and</em> half turns allowed in Phase 2</span>
          </div>
          <div className="hsg-legend-item">
            <span className="hsg-badge yellow">H½</span>
            <span>R, L, F, B — <strong>half turns only</strong> in Phase 2 (quarter turns orient edges)</span>
          </div>
          <div className="hsg-caption">
            The 10 Phase 2 generators are: U U' U2 · D D' D2 · R2 · L2 · F2 · B2.<br/>
            Phase 1 adds R R' F F' B B' L L' to get all 18 standard generators.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Phase 1 coordinate space diagram ─────────────────────────────────────────
// Shows the three Phase 1 coordinates as labeled bars.

function CoordinateSpaceDiagram() {
  const coords = [
    {
      name: 'flip',
      label: 'Edge orientation (flip)',
      range: 2048,
      bits: '11 bits',
      desc: 'Is each edge piece twisted w.r.t. the F/B axis? 0 = all 12 edges correctly oriented.',
      col: '#FF5800',
    },
    {
      name: 'twist',
      label: 'Corner orientation (twist)',
      range: 2187,
      bits: '3⁷ = 2187',
      desc: 'How many degrees (0°, 120°, 240°) is each corner twisted? 0 = all 8 corners correctly oriented.',
      col: '#fbbf24',
    },
    {
      name: 'slice',
      label: 'UD-slice position',
      range: 495,
      bits: 'C(12,4) = 495',
      desc: 'Are the 4 UD-slice edges (FR, FL, BR, BL) in the middle layer? 0 = all in their slice.',
      col: '#60a5fa',
    },
  ];

  // Phase 2 coordinate rows
  const p2coords = [
    {
      name: 'cperm',
      label: 'Corner permutation',
      range: 40320,
      bits: '8! = 40320',
      desc: 'Which corner is in which slot?',
      col: '#a78bfa',
    },
    {
      name: 'eperm',
      label: 'Edge permutation (non-slice)',
      range: 40320,
      bits: '8! = 40320',
      desc: 'Ordering of the 8 non-slice edges.',
      col: '#6ee7b7',
    },
    {
      name: 'slice4',
      label: 'UD-slice edge permutation',
      range: 24,
      bits: '4! = 24',
      desc: 'Ordering of the 4 UD-slice edges within their slice.',
      col: '#f9a8d4',
    },
  ];

  return (
    <div className="solver-diagram-card">
      <div className="sdc-title">Kociemba Coordinate Spaces</div>
      <div className="coord-section-label phase1-label">Phase 1 coordinates (product space: 2048 × 2187 × 495 ≈ 2.2 × 10⁹)</div>
      <div className="coord-rows">
        {coords.map(c => (
          <CoordRow key={c.name} {...c}/>
        ))}
      </div>
      <div className="coord-p1-goal">
        Phase 1 goal: reach <span className="mono-highlight">flip=0, twist=0, slice=0</span> simultaneously.
        A pruning table lower-bounds the distance; IDA* deepens until goal is found.
      </div>

      <div className="coord-section-label phase2-label" style={{marginTop:10}}>Phase 2 coordinates (within H — product space: 40320 × 40320 × 24 ≈ 3.9 × 10¹⁰)</div>
      <div className="coord-rows">
        {p2coords.map(c => (
          <CoordRow key={c.name} {...c}/>
        ))}
      </div>
      <div className="coord-p1-goal">
        Phase 2 goal: reach <span className="mono-highlight">cperm=0, eperm=0, slice4=0</span>. Since all moves stay in H, no edges or corners get disoriented.
      </div>
    </div>
  );
}

function CoordRow({ label, range, bits, desc, col }) {
  const barW = Math.round(Math.log2(range + 1) / Math.log2(43252003274489856000) * 100);
  return (
    <div className="coord-row">
      <div className="coord-row-header">
        <span className="coord-name" style={{color: col}}>{label}</span>
        <span className="coord-bits">{bits}</span>
      </div>
      <div className="coord-bar-track">
        <div className="coord-bar-fill" style={{width: `${barW}%`, background: col}}/>
        <span className="coord-bar-label">{range.toLocaleString()} states</span>
      </div>
      <div className="coord-desc">{desc}</div>
    </div>
  );
}

// ── Reduction Method panel for 4×4 / 5×5 ─────────────────────────────────────

const REDUCTION_SIZES = {
  4: {
    label: '4×4 (Revenge)',
    groupSize: '≈ 7.4 × 10⁴⁵',
    godsNumber: '≈ 35 moves',
    pieceCounts: '8 corners · 24 wing edges · 24 center stickers',
    phases: [
      {
        num: 1,
        title: 'Solve centres',
        col: '#FF5800',
        desc: 'Orient all 6 face centres. Each face has 4 centre pieces that must match the face colour. Use only inner-slice moves (2R, 2U…) to avoid disturbing pieces solved later. The symmetry group of the 24 centres is (Z₄)⁶, order ≈ 4.1 × 10⁴.',
        moves: '2R 2U 2R\' 2U\'',
        movesLabel: 'typical centre commutator',
      },
      {
        num: 2,
        title: 'Pair wing edges',
        col: '#fbbf24',
        desc: 'The 4×4 has two "wing" stickers per edge slot (12 slots × 2 = 24 wings). Pair matching wings using inner-slice triggers: move a wing from one slice, insert its partner, restore. After pairing, the 4×4 behaves like a 3×3 cube.',
        moves: 'Rw U R\' U\' Rw\'',
        movesLabel: 'edge-pairing trigger',
      },
      {
        num: 3,
        title: 'Solve as 3×3',
        col: '#60a5fa',
        desc: 'Apply Kociemba (or any 3×3 solver) using only outer-face moves. Watch for OLL parity (one edge flipped) or PLL parity (two edges swapped) — artefacts of the reduction that require special 4×4-specific fixes before the final solve.',
        moves: '— Kociemba on virtual 3×3 —',
        movesLabel: '3×3 phase',
      },
    ],
    parityNote: 'OLL parity: one edge visually flipped (impossible on 3×3). Fix: (r U2 x r U2 r\' U2 3r U2 Lw U2 r\' U2 r U2 r\' U2 Rw\'). PLL parity: two wings swapped (impossible on 3×3). Fix: r2 U2 r2 Uw2 r2 u2.',
  },
  5: {
    label: '5×5 (Professor)',
    groupSize: '≈ 2.8 × 10⁷⁴',
    godsNumber: '≈ 46 moves',
    pieceCounts: '8 corners · 24 wing edges · 9-sticker centres per face (1 fixed + 8 movable)',
    phases: [
      {
        num: 1,
        title: 'Solve + and cross centres',
        col: '#FF5800',
        desc: 'Each face has a 3×3 centre grid (9 stickers). First fix the 6 "+" centres (the centre sticker of each centre group, which is fixed-position), then solve the 8 surrounding centre stickers per face using 3-cycle commutators.',
        moves: '3R 2U 3R\' 2U\'',
        movesLabel: '5×5 centre commutator',
      },
      {
        num: 2,
        title: 'Pair wing edges (×3)',
        col: '#fbbf24',
        desc: 'The 5×5 has two separate wing layers per edge slot (inner and outer wings) plus the middle edge. Pair inner wings first, then outer wings, using slice-trigger sequences. After pairing, 36 wings + 12 midges reduce to 12 virtual "triple edges".',
        moves: '3Rw U R\' U\' 3Rw\'',
        movesLabel: 'wing pairing trigger',
      },
      {
        num: 3,
        title: 'Solve as 3×3',
        col: '#60a5fa',
        desc: 'Apply Kociemba on the virtual 3×3 using only outer-face moves. OLL and PLL parity can occur, requiring the same 4×4-style parity fixes.',
        moves: '— Kociemba on virtual 3×3 —',
        movesLabel: '3×3 phase',
      },
    ],
    parityNote: 'Same OLL and PLL parity as 4×4. Parity arises from the even-layer structure allowing odd permutations of wing edges that are impossible on odd-layer cubes.',
  },
};

function ReductionMethodPanel({ cubeSize }) {
  const info = REDUCTION_SIZES[cubeSize];
  if (!info) return null;

  return (
    <div className="solver-panel">
      <h3 className="panel-title"><span className="icon">★</span> Reduction Solver — {info.label}</h3>

      <div className="solver-intro-card">
        <div className="sic-title">The Reduction Method</div>
        <p className="sic-body">
          Kociemba's two-phase algorithm is designed for the 3×3. For {cubeSize}×{cubeSize},
          the standard approach is <strong>reduction</strong>: solve the extra pieces
          (centres and wing edges) until the puzzle behaves like a 3×3, then apply Kociemba.
        </p>
        <p className="sic-body">
          Group size: <span style={{color:'var(--orange)',fontFamily:'var(--mono)'}}>{info.groupSize}</span>
          {' · '}God's Number: <span style={{color:'var(--orange)',fontFamily:'var(--mono)'}}>{info.godsNumber}</span>
          {' · '}{info.pieceCounts}
        </p>
      </div>

      {/* Phase pipeline */}
      <div className="rdx-phases">
        {info.phases.map(ph => (
          <div key={ph.num} className="rdx-phase">
            <div className="rdx-phase-header">
              <span className="rdx-phase-badge" style={{background: ph.col}}>Phase {ph.num}</span>
              <span className="rdx-phase-title">{ph.title}</span>
            </div>
            <p className="rdx-phase-desc">{ph.desc}</p>
            <div className="rdx-phase-move">
              <span className="rdx-move-label">{ph.movesLabel}:</span>
              <span className="rdx-move-seq">{ph.moves}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Parity note */}
      <div className="rdx-parity">
        <div className="rdx-parity-label">⚠ Parity issues</div>
        <p className="rdx-parity-body">{info.parityNote}</p>
      </div>

      {/* Why Kociemba can't run directly */}
      <div className="solver-diagram-card">
        <div className="sdc-title">Why Kociemba doesn't directly apply to {cubeSize}×{cubeSize}</div>
        <p className="sic-body">
          Kociemba's Phase 1 coordinates (flip, twist, slice) are defined over the <em>corner</em> and
          <em>edge</em> piece types of a 3×3. A {cubeSize}×{cubeSize} has additional piece types (centre stickers,
          wing edges) with their own permutation groups. Extending the IDA* tables to cover all
          {' '}{6 * cubeSize * cubeSize} stickers would increase the coordinate space
          from ~10⁹ (3×3) to ~10{cubeSize === 4 ? '²⁰' : '³⁰'} — computationally intractable
          without specialised hardware or months of precomputation.
        </p>
        <p className="sic-body">
          The reduction method sidesteps this by first reducing the {cubeSize}×{cubeSize} to a
          virtual 3×3, then running Kociemba on the much smaller group. The trade-off: the
          full solution is not globally optimal (each phase is locally greedy), so solutions
          typically use more moves than necessary. This is why competitive speedcubing programs
          use domain-specific solvers per size.
        </p>
      </div>
    </div>
  );
}
