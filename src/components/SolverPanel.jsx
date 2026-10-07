import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { parseMoveSequence, isSolved } from '../lib/cubeState';
import { buildSolveInput } from '../lib/solveInput';
import Section from './ui/Section';
import BigCubeSolution from './BigCubeSolution';

// ── Phase 2 move set: only these are allowed in H = <U, D, R2, L2, F2, B2> ──
const PHASE2_SET = new Set(['U', "U'", 'U2', 'D', "D'", 'D2', 'R2', 'L2', 'F2', 'B2']);

/** True for a move that can only occur in Phase 1 (quarter turns of R/L/F/B) */
function isPhase1Only(tok) { return !PHASE2_SET.has(tok); }

/**
 * SolverPanel - the solver for every cube size.
 *   2×2        two-phase on the corners of a virtual 3×3
 *   3×3        two-phase, directly from the current colors
 *   4×4, 5×5   by reduction in a worker (centers, parity, edges, 3×3); a
 *              cube already reduced by hand just gets the parity fix and 3×3
 * Props:
 *   state, cubeSize
 *   animating      — true while a sequence plays
 *   playMoveSequence(turns, startState) — animates quarter turns
 *   stateRef       — always-current state ref
 *   detectedPattern — pattern detector result (reduction progress on big cubes)
 */
export default function SolverPanel({
  state,
  cubeSize,
  animating,
  playMoveSequence,
  stateRef,
  detectedPattern = null,
}) {
  const [workerReady, setWorkerReady] = useState(false);
  const [solving, setSolving]         = useState(false);
  const [solution, setSolution]       = useState(null); // { prefix, moves, phase1Length }
  const [solveError, setSolveError]   = useState(null);
  const workerRef = useRef(null);
  const reqIdRef  = useRef(0);
  // Big cubes: the reduction solver, in its own worker, started on first use
  const [bigSolution, setBigSolution] = useState(null); // { start, stages }
  const [bigStep, setBigStep]         = useState(null); // progress while solving
  const [bigError, setBigError]       = useState(null);
  const bigWorkerRef = useRef(null);
  const bigReqRef    = useRef(0);
  const bigStartRef  = useRef(null); // the state the current request solves
  useEffect(() => () => bigWorkerRef.current?.terminate(), []);
  const pendingPrefixRef = useRef([]);

  // ── Worker lifecycle (one solver for every size) ──────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL('../lib/solver.worker.js', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      const { type, id, moves, phase1Length, error: err } = e.data;
      if (type === 'ready') { setWorkerReady(true); return; }
      if (id !== reqIdRef.current) return;
      setSolving(false);
      if (err) {
        setSolveError(`Solver error: ${err}`);
        setSolution(null);
      } else {
        setSolution({ prefix: pendingPrefixRef.current, moves, phase1Length });
        setSolveError(null);
      }
    };
    worker.onerror = (e) => {
      setSolving(false);
      setSolveError('Worker crashed: ' + (e.message || 'unknown'));
    };
    workerRef.current = worker;
    return () => { worker.terminate(); workerRef.current = null; setWorkerReady(false); };
  }, []);

  const input = useMemo(() => buildSolveInput(state, cubeSize), [state, cubeSize]);
  const cubeIsSolved = isSolved(state);

  // Reset solution when cube state changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSolution(null);
    setSolveError(null);
  }, [state]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSolve = useCallback(() => {
    if (!workerRef.current || !workerReady || solving || animating || !input.ok) return;
    setSolution(null);
    setSolveError(null);
    setSolving(true);
    reqIdRef.current += 1;
    pendingPrefixRef.current = input.prefix;
    workerRef.current.postMessage({ facelets: input.facelets, id: reqIdRef.current });
  }, [workerReady, solving, animating, input]);

  // Animate: parity fix (big cubes) followed by the two-phase solution
  const handlePlay = useCallback(() => {
    if (!solution || animating) return;
    const sequence = [...solution.prefix.map(p => p.notation), ...solution.moves].join(' ');
    const turns = parseMoveSequence(sequence, cubeSize);
    if (turns.length) playMoveSequence(turns, stateRef.current);
  }, [solution, animating, cubeSize, playMoveSequence, stateRef]);

  const handleBigSolve = useCallback(() => {
    if (bigStep || animating) return;
    if (!bigWorkerRef.current) {
      const w = new Worker(new URL('../lib/bigcube/bigcube.worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => {
        const { type, id, step, stages, error: err } = e.data;
        if (id !== bigReqRef.current) return;
        if (type === 'progress') { setBigStep(step); return; }
        setBigStep(null);
        if (err) setBigError(`Solver error: ${err}`);
        else setBigSolution({ start: bigStartRef.current, stages });
      };
      w.onerror = (e) => { setBigStep(null); setBigError('Solver crashed: ' + (e.message || 'unknown')); };
      bigWorkerRef.current = w;
    }
    bigReqRef.current += 1;
    setBigError(null);
    setBigSolution(null);
    setBigStep('tables');
    bigStartRef.current = stateRef.current;
    bigWorkerRef.current.postMessage({ id: bigReqRef.current, state: stateRef.current, N: cubeSize });
  }, [bigStep, animating, stateRef, cubeSize]);

  const playTurns = useCallback((turns) => {
    if (!animating && turns.length) playMoveSequence(turns, stateRef.current);
  }, [animating, playMoveSequence, stateRef]);

  const isBig = cubeSize > 3;
  const fullBigSolve = isBig && !input.ok; // not reduced yet: the worker does everything
  const reduction = isBig ? REDUCTION_SIZES[cubeSize] : null;

  const caption = cubeSize === 2 ? 'Kociemba two-phase, on the corners of a virtual 3×3.'
    : isBig ? 'Centers, then edges, then it is a 3×3: the way people solve big cubes.'
    : 'Kociemba two-phase, from the current colors.';
  const bigStepText = { tables: 'Getting ready…', centers: 'Solving the centers…', edges: 'Matching the edges…', '3x3': 'Finishing the 3×3…' };

  return (
    <div className="panel-stack">
      <Section title="Solve" caption={caption} className="solver-panel">

        {/* ── Big cube: reduction progress until the solver can take over ── */}
        {isBig && (
          <ReductionStatus input={input} pattern={detectedPattern} solved={cubeIsSolved} />
        )}

        {/* ── Worker status ── */}
        {!fullBigSolve && (
          <div className={`solver-status-bar ${workerReady ? 'ready' : 'loading'}`}>
            {workerReady
              ? <><span className="ssb-dot green"/>Solver ready</>
              : <><span className="ssb-dot spin"/>Building the two-phase tables…</>}
          </div>
        )}

        {/* ── Solve button ── */}
        {fullBigSolve ? (
          <button
            className={`solver-solve-btn ${bigStep ? 'solving' : ''}`}
            onClick={handleBigSolve}
            disabled={!!bigStep || animating || cubeIsSolved}
          >
            {bigStep ? <><span className="btn-spin">⏳</span> {bigStepText[bigStep]}</> : '★ Find solution'}
          </button>
        ) : (
        <button
          className={`solver-solve-btn ${solving ? 'solving' : ''}`}
          onClick={handleSolve}
          disabled={!workerReady || solving || animating || cubeIsSolved || !input.ok}
          title={
            !workerReady     ? 'Initializing…'
            : cubeIsSolved   ? 'Cube is already solved'
            : !input.ok      ? input.reason
            : solving        ? 'Searching…'
            : 'Run the two-phase solver'
          }
        >
          {solving
            ? <><span className="btn-spin">⏳</span> Solving…</>
            : cubeIsSolved ? '✓ Already solved'
            : isBig ? '★ Finish the reduced cube'
            : '★ Find solution'}
        </button>
        )}
        {bigError && <div className="solver-error">{bigError}</div>}
        {isBig && bigSolution && (
          <BigCubeSolution solution={bigSolution} state={state} animating={animating} onPlay={playTurns} />
        )}

        {!input.ok && !cubeIsSolved && !isBig && <div className="solver-error">{input.reason}</div>}
        {solveError && <div className="solver-error">{solveError}</div>}

        {/* ── Solution result with phase visualisation ── */}
        {solution && !solveError && (
          <SolutionDisplay
            solution={solution}
            animating={animating}
            onPlay={handlePlay}
            cubeIsSolved={cubeIsSolved}
          />
        )}
      </Section>

      {/* ── Big cube: the method ── */}
      {reduction && (
        <Section title="Reduction method" caption="Centers → edges → solve as a 3×3."
          why={<p>{reduction.parityNote}</p>}>
          {(open) => open && <ReductionMethod info={reduction} />}
        </Section>
      )}

      {/* ── How the two-phase algorithm works ── */}
      <Section
        title="How it works"
        caption="Reach the subgroup H = ⟨U, D, R2, L2, F2, B2⟩, then solve inside it."
        why={<p>
          Both phases are IDA* searches over small coordinates of the cube (corner twist, edge
          flip, slice position; then permutations), guided by exact distance tables that are built
          once when the page loads.
        </p>}
      >
        {(open) => open && (
          <div className="solver-diagrams">
            <TwoPhaseSearchDiagram />
            <HSubgroupDiagram />
            <CoordinateSpaceDiagram />
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Big cube: where the reduction stands ──────────────────────────────────────

function ReductionStatus({ input, pattern, solved }) {
  if (solved) return null;
  if (input.ok) {
    return (
      <div className="rdx-status ready">
        <div className="rdx-status-title">✓ Reduced to a 3×3</div>
        <p className="rdx-status-body">
          Centers are solved and all 12 edges are paired, so the solver can finish the cube with
          outer turns{input.prefix.length > 0 && <> after fixing <strong>{input.prefix.map(p => p.label).join(' and ')}</strong></>}.
        </p>
      </div>
    );
  }
  return (
    <div className="rdx-status">
      <div className="rdx-status-title">Reduce first: {pattern?.stageLabel ?? 'Centers'}</div>
      {pattern?.steps?.length > 0 && (
        <ol className="pd-steps" aria-label="Reduction stages">
          {pattern.steps.map(st => (
            <li key={st.id} className={`pd-step ${st.status}`}>{st.status === 'done' ? '✓ ' : ''}{st.label}</li>
          ))}
        </ol>
      )}
      <p className="rdx-status-body">{pattern?.message}</p>
      {pattern?.progress && (
        <div className="pd-progress">
          <span className="pd-progress-bar">
            <span className="pd-progress-fill" style={{ width: `${(pattern.progress.done / pattern.progress.total) * 100}%`, background: 'var(--orange)' }} />
          </span>
          <span className="pd-progress-text">{pattern.progress.done}/{pattern.progress.total} {pattern.progress.unit}</span>
        </div>
      )}
      <p className="rdx-status-note">
        Do it yourself with the Algorithms tab, or let the solver do every stage.
      </p>
    </div>
  );
}

// ── Solution display with parity fix and exact Phase 1 / Phase 2 split ──────

function SolutionDisplay({ solution, animating, onPlay, cubeIsSolved }) {
  const { prefix, moves, phase1Length } = solution;
  const p1 = moves.slice(0, phase1Length);
  const p2 = moves.slice(phase1Length);
  const prefixCount = prefix.reduce((n, p) => n + p.notation.split(/\s+/).length, 0);
  if (moves.length === 0 && prefix.length === 0) {
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
        <span className="srh-count">
          {moves.length} moves{prefixCount > 0 && ` + ${prefixCount} for parity`}
        </span>
      </div>

      {/* Parity fix (big cubes) */}
      {prefix.map(p => (
        <div key={p.label} className="phase-block parity">
          <div className="phase-block-label">
            <span className="phase-badge parity">{p.label}</span>
            <span className="phase-desc">{p.name}</span>
          </div>
          <div className="phase-moves">
            {p.notation.split(/\s+/).map((tok, i) => (
              <span key={i} className="solver-move-token parity">{tok}</span>
            ))}
          </div>
        </div>
      ))}

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
      <div className="sdc-title">Two phases</div>
      <svg viewBox="0 0 360 220" className="sdc-svg" aria-label="Two-phase IDA* search diagram">

        {/* ── Axes ── */}
        {/* State space blob: full cube group */}
        <ellipse cx="180" cy="110" rx="168" ry="96"
          fill="none" stroke="#3a3228" strokeWidth="1.2"/>
        <text x="10" y="18" fontSize="10" fill="#8a8070">G · 4.3 × 10¹⁹</text>

        {/* H subgroup blob */}
        <ellipse cx="265" cy="130" rx="82" ry="58"
          fill="rgba(0,75,173,0.08)" stroke="#0046AD" strokeWidth="1" strokeDasharray="4 3"/>
        <text x="300" y="92" fontSize="10" fill="#60a5fa" fontWeight="bold">H · 1.95 × 10¹⁰</text>

        {/* Solved state dot */}
        <circle cx="280" cy="148" r="5" fill="#009B48"/>
        <text x="288" y="152" fontSize="10" fill="#34d399" fontWeight="bold">solved</text>

        {/* Scrambled state dot */}
        <circle cx="62" cy="80" r="5" fill="#B71234"/>
        <text x="30" y="98" fontSize="10" fill="#f87171" fontWeight="bold">scrambled</text>

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
        <text x="100" y="52" fontSize="10" fill="#FF8C42" fontWeight="bold">Phase 1 · ≤ 12</text>

        {/* Phase 2 label on path */}
        <text x="196" y="140" fontSize="10" fill="#60a5fa" fontWeight="bold">Phase 2 · ≤ 18</text>

        {/* H boundary dot (where phase 1 lands) */}
        <circle cx="192" cy="107" r="4" fill="#FFD500" stroke="#FF5800" strokeWidth="1"/>

      </svg>
      <div className="sdc-note">
        Phase 1 reaches H = ⟨U, D, R2, L2, F2, B2⟩ in at most 12 moves; phase 2 finishes inside H
        in at most 18. The solver keeps searching briefly for a shorter total, typically 21–23 moves.
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
      <div className="sdc-title">Phase 2 moves</div>
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
      <div className="sdc-title">Coordinates</div>
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
    pieceCounts: '8 corners · 24 wings · 24 centers',
    phases: [
      {
        num: 1,
        title: 'Solve the centers',
        col: '#FF5800',
        desc: 'Build a solid 2×2 center on every face. The 24 centers form one orbit (see the Graph Theory tab); same-colored centers are interchangeable, so (4!)⁶ different arrangements all look solved. Inner slice turns move centers, outer turns only spin them.',
        moves: "2R U 2R'",
        movesLabel: 'move a center piece between faces',
      },
      {
        num: 2,
        title: 'Pair the edges',
        col: '#fbbf24',
        desc: 'Each edge slot holds two wings, one from each mirror-image wing orbit. Line up two matching wings with an inner slice, swap the new pair out with R U R\', then undo the slice so the centers stay solved.',
        moves: "Uw R U R' Uw'",
        movesLabel: 'slice–flip–slice',
      },
      {
        num: 3,
        title: 'Solve as a 3×3',
        col: '#60a5fa',
        desc: 'Now outer turns act on the 4×4 exactly like 3×3 turns. Two positions cannot occur on a real 3×3: OLL parity (the edge flips sum to an odd number) and PLL parity (edge and corner permutations of different parity). Fix them with the parity algorithms, then solve the 3×3.',
        moves: 'parity fix + two-phase solve (this tab)',
        movesLabel: '3×3 phase',
      },
    ],
    parityNote: "OLL parity: 2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2 (flips the UF edge; 9 inner-slice quarter turns make the wing permutation odd). PLL parity: 2R2 U2 2R2 Uw2 2R2 Uw2 (swaps two edges, followed by U2).",
  },
  5: {
    label: '5×5 (Professor)',
    groupSize: '≈ 2.8 × 10⁷⁴',
    pieceCounts: '8 corners · 12 midges · 24 wings · 24 X-centers · 24 +-centers · 6 fixed centers',
    phases: [
      {
        num: 1,
        title: 'Solve the centers',
        col: '#FF5800',
        desc: 'Each face has 9 center stickers: the fixed middle one, 4 +-centers and 4 X-centers. The +- and X-centers are two separate orbits of 24, so each kind only ever trades places with its own kind. Build a solid 3×3 center on every face.',
        moves: "2R U 2R'",
        movesLabel: 'move an X-center between faces',
      },
      {
        num: 2,
        title: 'Pair the edges',
        col: '#fbbf24',
        desc: 'Each edge slot holds a midge and two wings (one from each mirror-image wing orbit). Pair the two wings with their midge into a "tredge", using slice–flip–slice. The last edge can end up with its wings swapped: flip them with the edge-flip algorithm.',
        moves: "Uw R U R' Uw'",
        movesLabel: 'slice–flip–slice',
      },
      {
        num: 3,
        title: 'Solve as a 3×3',
        col: '#60a5fa',
        desc: 'Once reduced, the corners, midges and fixed centers are exactly a 3×3, so there is no OLL or PLL parity: this tab solves it directly with outer turns.',
        moves: 'two-phase solve (this tab)',
        movesLabel: '3×3 phase',
      },
    ],
    parityNote: 'No parity after reduction: the midges fix the edge parity just like 3×3 edges. The only parity-like case is while pairing the last edge, when its two wings are swapped.',
  },
};

function ReductionMethod({ info }) {
  return (
    <div className="rdx-method">
      <p className="rdx-facts">
        <span className="math-mono">{info.groupSize}</span> · {info.pieceCounts}
      </p>
      <div className="rdx-phases">
        {info.phases.map(ph => (
          <div key={ph.num} className="rdx-phase">
            <div className="rdx-phase-header">
              <span className="rdx-phase-badge" style={{background: ph.col}}>{ph.num}</span>
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
    </div>
  );
}
