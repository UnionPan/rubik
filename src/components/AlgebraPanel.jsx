import { useMemo, useState, useCallback } from 'react';
import { permToCycles, solvedState, FACE_NAMES, COLORS } from '../lib/cubeState';
import { algorithmOrder } from '../lib/algorithms';
import Section from './ui/Section';

const GROUP_SIZES = {
  2: { math: '|G₂| = 3,674,160', fact: "God's number for the 2×2 is 11 (half turns)." },
  3: { math: '|G₃| ≈ 4.3 × 10¹⁹', fact: "God's number for the 3×3 is 20 (half turns), proven in 2010." },
  4: { math: '|G₄| ≈ 7.4 × 10⁴⁵', fact: "God's number for the 4×4 is not known." },
  5: { math: '|G₅| ≈ 2.8 × 10⁷⁴', fact: "God's number for the 5×5 is not known." },
};

const lcm = (a, b) => { const g = (x, y) => (y ? g(y, x % y) : x); return (a / g(a, b)) * b; };

/** Apply one turn's cycles to a permutation (perm[i] = where the sticker now at i started) */
function composeTurn(model, perm, turn) {
  const next = [...perm];
  for (const cyc of model.turnCycles(turn)) {
    for (let k = 0; k < cyc.length; k++) next[cyc[(k + 1) % cyc.length]] = perm[cyc[k]];
  }
  return next;
}
const identity = (n) => Array.from({ length: n }, (_, i) => i);
const formatCycles = (model, cycles) => cycles.map(c => `(${c.map(model.slotLabel).join(' ')})`).join('');

/**
 * AlgebraPanel - the Groups view of the Math tab, for any puzzle.
 * Props:
 *   model: puzzle model (lib/puzzles/models)
 *   state: puzzle state
 *   moveHistory: quarter turns [{notation, face, layers, cw}, ...] since reset/scramble
 *   solvePath: every quarter turn since the last solved state (scramble + moves),
 *              which pins down the exact sticker permutation
 *   algorithm: the algorithm selected in the Algorithms tab (cubes), or null
 *   godsNumber: known God's number (puzzles whose group is enumerated), or null
 */
export default function AlgebraPanel({ model, state, moveHistory = [], solvePath = [], algorithm = null, godsNumber = null }) {
  const isCube = model.kind === 'cube';
  const N = model.N;
  const stickers = model.stickerCount;

  // Track which trace rows have their cycle string expanded
  const [expandedRows, setExpandedRows] = useState({});
  const toggleRow = useCallback((i) => {
    setExpandedRows(prev => ({ ...prev, [i]: !prev[i] }));
  }, []);

  // ── Current permutation, exact: compose every turn since solved ───────
  // (Colors alone cannot tell identical stickers apart on big cubes.)
  const perm   = useMemo(
    () => solvePath.reduce((p, t) => composeTurn(model, p, t), identity(stickers)),
    [solvePath, model, stickers],
  );
  const cycles = useMemo(() => permToCycles(perm, true), [perm]);
  const looksSolved = model.isSolved(state);

  const movedCount = cycles.reduce((a, c) => a + c.length, 0);
  const cycleTypes = {};
  cycles.forEach(c => { cycleTypes[c.length] = (cycleTypes[c.length] || 0) + 1; });
  const cycleTypeStr = Object.entries(cycleTypes)
    .sort(([a], [b]) => +a - +b)
    .map(([len, cnt]) => cnt > 1 ? `${cnt}×(${len}-cycle)` : `(${len}-cycle)`)
    .join(' ∘ ');
  const parity = cycles.reduce((s, c) => s + c.length - 1, 0) % 2 === 0 ? 'Even' : 'Odd';
  const order = cycles.reduce((o, c) => lcm(o, c.length), 1);

  const algOrder = useMemo(() => (algorithm && isCube ? algorithmOrder(algorithm, N) : null), [algorithm, isCube, N]);
  // Order of a two-move sequence: R U on cubes, the first two axes elsewhere
  const sample = isCube ? 'R U' : `${model.axes[0].name} ${model.axes[1].name}`;
  const sampleOrder = useMemo(() => {
    const p = model.parseMoveSequence(sample).reduce((acc, t) => composeTurn(model, acc, t), identity(stickers));
    return permToCycles(p, true).reduce((o, c) => lcm(o, c.length), 1);
  }, [model, sample, stickers]);
  const size = isCube
    ? GROUP_SIZES[N]
    : { math: `|G| = ${model.groupOrder}`, fact: godsNumber != null ? `God's number is ${godsNumber}, found by visiting every position.` : 'Counting every position…' };

  // ── Janet Chen trace: accumulate permutation step-by-step ─────────────
  const trace = useMemo(() => {
    const rows = [];
    let p = identity(stickers);
    for (const turn of moveHistory) {
      p = composeTurn(model, p, turn);
      const cumCycles = permToCycles(p, true);
      rows.push({
        notation: turn.notation,
        cumCycleStr: formatCycles(model, cumCycles.slice(0, 4)) +
          (cumCycles.length > 4 ? ` ···+${cumCycles.length - 4}` : ''),
        cumCycleStrFull: formatCycles(model, cumCycles),
        cumParity: cumCycles.reduce((acc, c) => acc + c.length - 1, 0) % 2 === 0 ? 'even' : 'odd',
        cumCycleCount: cumCycles.length,
        hasMore: cumCycles.length > 4,
      });
    }
    return rows;
  }, [moveHistory, model, stickers]);

  return (
    <div className="panel-stack">
      {/* ── Live position ── */}
      <Section
        title="Your position"
        caption="The exact sticker permutation since solved."
        why={<>
          <p>
            A <strong>group</strong> is a set with a way to combine elements that is associative,
            has an identity and has inverses. Cube positions form one: a turn is an element,
            doing two turns is multiplication, and undoing a turn is its inverse.
          </p>
          <p>
            Every turn shuffles the {stickers} stickers, so every position is a
            <strong> permutation</strong>. A <em>cycle</em> is a ring of stickers that each take the
            next one&apos;s place; <em>parity</em> is whether the permutation is an even or odd
            number of swaps; the <em>order</em> is how often you could repeat it before returning to start.
          </p>
        </>}
      >
        <div className="algebra-stat-row">
          <StatChip label="Moved" tooltip={`Stickers not in their starting position, out of ${stickers}`} value={movedCount} />
          <StatChip label="Cycles" tooltip="Disjoint cycles in the permutation" value={cycles.length} />
          <StatChip label="Parity" tooltip="Even or odd number of swaps" value={parity}
            color={parity === 'Even' ? '#6ee7b7' : '#f87171'} />
          <StatChip label="Order" tooltip="Repeat this permutation this often to return to the start" value={order} />
        </div>
        {cycles.length > 0 && <div className="cycle-type-str math-mono">σ = {cycleTypeStr}</div>}
        {cycles.length === 0 && <div className="solved-note">✓ Identity: every sticker is home.</div>}
        {cycles.length > 0 && looksSolved && (
          <div className="solved-note">
            ✓ Looks solved, but {movedCount} stickers traded places with same-colored ones:
            a non-identity element that fixes the coloring.
          </div>
        )}
      </Section>

      {/* ── Selected algorithm ── */}
      {algorithm && algOrder && (
        <Section
          title={algorithm.name}
          caption={algorithm.algebraNote || algorithm.notation}
          why={<>
            {algorithm.groupTheoryNote && <p>{algorithm.groupTheoryNote}</p>}
            {algorithm.refs?.length > 0 && (
              <p className="refs">
                {algorithm.refs.map((ref, i) => (
                  <span key={i}>
                    {ref.url ? <a href={ref.url} target="_blank" rel="noreferrer">{ref.label}</a> : ref.label}
                    {i < algorithm.refs.length - 1 ? ' · ' : ''}
                  </span>
                ))}
              </p>
            )}
          </>}
        >
          <div className="algebra-stat-row">
            <StatChip label="Order" tooltip="Repetitions until every sticker is home" value={algOrder.order} />
            {algOrder.looksSolvedAfter !== algOrder.order && (
              <StatChip label="Looks solved after" tooltip="Repetitions until the colors match again"
                value={algOrder.looksSolvedAfter} />
            )}
          </div>
        </Section>
      )}

      {/* ── Janet Chen permutation trace ── */}
      {trace.length > 0 && (
        <Section
          title="Move trace"
          caption="Each turn composed into the running permutation."
          why={<PermTraceExplainer stickers={stickers} />}
        >
          <div className="perm-trace">
            <div className="perm-trace-row perm-trace-header">
              <span className="pt-move">Move</span>
              <span className="pt-cycles">Cycles</span>
              <span className="pt-meta">#</span>
              <span className="pt-parity">Parity</span>
            </div>
            <div className="perm-trace-row perm-trace-identity">
              <span className="pt-move">start</span>
              <span className="pt-cycles math-mono">identity</span>
              <span className="pt-meta">0</span>
              <span className="pt-parity even">even</span>
            </div>
            {trace.map((entry, i) => {
              const isExpanded = !!expandedRows[i];
              return (
                <div
                  key={i}
                  className={`perm-trace-row ${i === trace.length - 1 ? 'perm-trace-current' : ''}${isExpanded ? ' perm-trace-expanded' : ''}`}
                >
                  <span className="pt-move">
                    <span className="move-badge">{entry.notation}</span>
                  </span>
                  <span className="pt-cycles-wrap">
                    <span className="pt-cycles math-mono">
                      {isExpanded ? entry.cumCycleStrFull : (entry.cumCycleStr || 'id')}
                    </span>
                    {entry.hasMore && (
                      <button
                        className="pt-expand-btn"
                        onClick={() => toggleRow(i)}
                        title={isExpanded ? 'Collapse' : `Show all ${entry.cumCycleCount} cycles`}
                      >
                        {isExpanded ? '▲ less' : `▼ +${entry.cumCycleCount - 4}`}
                      </button>
                    )}
                  </span>
                  <span className="pt-meta">{entry.cumCycleCount}</span>
                  <span className={`pt-parity ${entry.cumParity}`}>{entry.cumParity}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Cycle chord diagram ── */}
      <Section
        title="Cycle diagram"
        caption="Arcs join stickers in the same cycle."
        why={<p>
          All {stickers} sticker positions sit on a circle, grouped by face. Each cycle of the
          current permutation is drawn in its own color; a solved cube shows no arcs.
        </p>}
      >
        <CycleChordDiagram cycles={cycles} model={model} />
      </Section>

      {/* ── Piece orbit diagram (3×3) ── */}
      {isCube && N === 3 && (
        <Section
          title="Pieces"
          caption="Corners outside, edges inside; orange rings are out of place."
          why={<p>
            Corners can only go to corner slots and edges to edge slots: they are separate
            orbits of the group. Each node shows the colors of the piece currently in that slot.
          </p>}
        >
          <PieceOrbitDiagram state={state} N={N} />
        </Section>
      )}

      {/* ── Key concepts ── */}
      <Section
        title="Toolkit"
        why={<p>
          Commutators and conjugates are how cubers build algorithms: a commutator confines
          the change to the pieces A and B share, and a conjugate moves that change to where
          it is needed. The order of an element divides the order of the group (Lagrange).
        </p>}
      >
        {(open) => (
          <div className="concept-grid">
            <ConceptCard open={open} title="Commutator" math="[A, B] = A B A⁻¹ B⁻¹"
              desc="Do A, do B, undo A, undo B. Only the pieces both moves touch change." />
            <ConceptCard open={open} title="Conjugate" math="A B A⁻¹"
              desc="Set up with A, do B, undo the setup: B's effect, moved somewhere else." />
            <ConceptCard open={open} title="Order" math={`|${sample}| = ${sampleOrder}`}
              desc={`Repeat ${sample} ${sampleOrder} times and every sticker is home again.`} />
            <ConceptCard open={open} title="Group size" math={size.math} desc={size.fact} />
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Cycle Chord Diagram ───────────────────────────────────────────────────────
// Arranges 54 sticker positions in a circle (6 face groups of 9), draws arcs for each cycle.

const FACE_COLORS_HEX = ['#FFFFFF','#B71234','#009B48','#FFD500','#FF5800','#0046AD'];
const CYCLE_PALETTE   = [
  '#FF5800','#009B48','#0046AD','#FFD500','#B71234',
  '#6ee7b7','#f87171','#a78bfa','#fbbf24','#60a5fa',
];

function CycleChordDiagram({ cycles, model }) {
  const total = model.stickerCount;
  const faces = model.faceNames.length;
  const R = 88, cx = 110, cy = 110;
  // Dots shrink with the sticker count so neighbours never overlap
  const r = Math.min(5, (Math.PI * R) / total * 0.8);
  const gapPerFace = 0.08; // radians of empty space between face groups

  // Slots grouped by face, each face an arc of the circle
  const { faceOf, indexOnFace, perFace } = useMemo(() => {
    const fo = [], io = [], pf = new Array(faces).fill(0);
    for (let i = 0; i < total; i++) { const f = model.slotFace(i); fo.push(f); io.push(pf[f]++); }
    return { faceOf: fo, indexOnFace: io, perFace: pf };
  }, [model, total, faces]);
  const pos = (i) => {
    const f = faceOf[i];
    const span = (2 * Math.PI) / faces - gapPerFace;
    const angle = f * (2 * Math.PI / faces) + gapPerFace / 2 + (span * (indexOnFace[i] + 0.5)) / perFace[f] - Math.PI / 2;
    return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
  };
  const facePole = (f) => {
    const angle = f * (2 * Math.PI / faces) + Math.PI / faces - Math.PI / 2;
    return { x: cx + R * 1.22 * Math.cos(angle), y: cy + R * 1.22 * Math.sin(angle) };
  };

  const inCycle = new Uint8Array(total);
  const arcs = [];
  cycles.slice(0, 40).forEach((cycle, ci) => {
    const color = CYCLE_PALETTE[ci % CYCLE_PALETTE.length];
    cycle.forEach((a, k) => {
      const b = cycle[(k + 1) % cycle.length];
      const pa = pos(a), pb = pos(b);
      // Quadratic bezier pulled toward the center
      const qx = cx + ((pa.x + pb.x) / 2 - cx) * 0.45, qy = cy + ((pa.y + pb.y) / 2 - cy) * 0.45;
      arcs.push(
        <path key={`a${ci}-${k}`}
          d={`M${pa.x.toFixed(1)},${pa.y.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${pb.x.toFixed(1)},${pb.y.toFixed(1)}`}
          fill="none" stroke={color} strokeWidth="1.2" strokeOpacity="0.75" />,
      );
    });
  });
  cycles.forEach(c => c.forEach(i => { inCycle[i] = 1; }));

  return (
    <svg viewBox="0 0 220 220" width="220" height="220" style={{ display: 'block', margin: '0 auto' }}>
      {model.faceNames.map((name, f) => {
        const { x, y } = facePole(f);
        return (
          <text key={name} x={x} y={y + 3} textAnchor="middle"
            fontSize={name.length > 1 ? 7 : 9} fill={model.colors[f]} fontWeight="bold">{name}</text>
        );
      })}
      {arcs}
      {Array.from({ length: total }, (_, i) => {
        const { x, y } = pos(i);
        return (
          <circle key={i} cx={x} cy={y} r={r}
            fill={model.colors[faceOf[i]]}
            stroke={inCycle[i] ? '#fff' : '#333'}
            strokeWidth={inCycle[i] ? 1 : 0.4}
            opacity={inCycle[i] ? 1 : 0.45} />
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fill="#7a7060">σ</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="8" fill="#7a7060">
        {cycles.length === 0 ? 'identity' : `${cycles.length} cycles`}
      </text>
    </svg>
  );
}

// ── Piece Orbit Diagram ───────────────────────────────────────────────────────
// Shows two concentric rings: corners (outer, 8 nodes) and edges (inner, 12 nodes).
// Each node is colored by the sticker colors of the piece in that slot.

// Corner positions for 3×3: [slotName, [U-sticker, side1-sticker, side2-sticker]]
// Reading order: UFR, UBR, UBL, UFL, DFR, DBR, DBL, DFL
const CORNERS_3 = [
  { name:'UFR', stickers:[[0,2,2],[1,0,0],[2,0,2]] },
  { name:'UBR', stickers:[[0,0,2],[5,0,0],[1,0,2]] },
  { name:'UBL', stickers:[[0,0,0],[4,0,0],[5,0,2]] },
  { name:'UFL', stickers:[[0,2,0],[2,0,0],[4,0,2]] },
  { name:'DFR', stickers:[[3,0,2],[2,2,2],[1,2,0]] },
  { name:'DBR', stickers:[[3,2,2],[1,2,2],[5,2,0]] },
  { name:'DBL', stickers:[[3,2,0],[5,2,2],[4,2,2]] },
  { name:'DFL', stickers:[[3,0,0],[4,2,0],[2,2,0]] },
];
// Edge positions: [slotName, [sideA-sticker, sideB-sticker]]
const EDGES_3 = [
  { name:'UF', stickers:[[0,2,1],[2,0,1]] },
  { name:'UR', stickers:[[0,1,2],[1,0,1]] },
  { name:'UB', stickers:[[0,0,1],[5,0,1]] },
  { name:'UL', stickers:[[0,1,0],[4,0,1]] },
  { name:'FR', stickers:[[2,1,2],[1,1,0]] },
  { name:'FL', stickers:[[2,1,0],[4,1,2]] },
  { name:'BR', stickers:[[5,1,0],[1,1,2]] },
  { name:'BL', stickers:[[5,1,2],[4,1,0]] },
  { name:'DF', stickers:[[3,0,1],[2,2,1]] },
  { name:'DR', stickers:[[3,1,2],[1,2,1]] },
  { name:'DB', stickers:[[3,2,1],[5,2,1]] },
  { name:'DL', stickers:[[3,1,0],[4,2,1]] },
];

function PieceOrbitDiagram({ state, N }) {
  if (N !== 3) {
    return <div className="diagram-note" style={{textAlign:'center',padding:'12px 0'}}>
      Piece orbit diagram shown for 3×3 only.
    </div>;
  }

  const solved = solvedState(3);

  // Get color hex for a sticker at [face,row,col]
  const stickerColor = (src) => {
    const [f, r, c] = src;
    const colorIdx = state[f][r][c];
    return FACE_COLORS_HEX[colorIdx] || '#888';
  };
  // Check if a piece is in its solved position
  const isCornerSolved = (stickers) =>
    stickers.every(s => state[s[0]][s[1]][s[2]] === solved[s[0]][s[1]][s[2]]);
  const isEdgeSolved = (stickers) =>
    stickers.every(s => state[s[0]][s[1]][s[2]] === solved[s[0]][s[1]][s[2]]);

  // Layout: outer ring = corners (8), inner ring = edges (12)
  const svgW = 240, svgH = 240, cxS = 120, cyS = 120;
  const Rc = 95, Re = 58; // corner ring radius, edge ring radius

  const cornerPos = (i) => {
    const a = (2 * Math.PI * i / 8) - Math.PI / 2;
    return { x: cxS + Rc * Math.cos(a), y: cyS + Rc * Math.sin(a) };
  };
  const edgePos = (i) => {
    const a = (2 * Math.PI * i / 12) - Math.PI / 2;
    return { x: cxS + Re * Math.cos(a), y: cyS + Re * Math.sin(a) };
  };

  return (
    <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
      {/* Ring circles */}
      <circle cx={cxS} cy={cyS} r={Rc} fill="none" stroke="#2a2a2a" strokeWidth="1" />
      <circle cx={cxS} cy={cyS} r={Re} fill="none" stroke="#2a2a2a" strokeWidth="1" />


      {/* Corners */}
      {CORNERS_3.map((corner, i) => {
        const { x, y } = cornerPos(i);
        const colors = corner.stickers.map(s => stickerColor(s));
        const isSolved = isCornerSolved(corner.stickers);
        const pieceR = 13;
        // Draw 3 colored wedges
        return (
          <g key={corner.name}>
            <circle cx={x} cy={y} r={pieceR}
              fill="#1a1810"
              stroke={isSolved ? '#444' : '#FF5800'}
              strokeWidth={isSolved ? 1 : 2}
            />
            {colors.map((col, ci) => {
              const a1 = (ci * 120 - 30) * Math.PI / 180;
              const a2 = ((ci + 1) * 120 - 30) * Math.PI / 180;
              const x1 = x + (pieceR - 2) * Math.cos(a1);
              const y1 = y + (pieceR - 2) * Math.sin(a1);
              const x2 = x + (pieceR - 2) * Math.cos(a2);
              const y2 = y + (pieceR - 2) * Math.sin(a2);
              return (
                <path key={ci}
                  d={`M${x},${y} L${x1.toFixed(1)},${y1.toFixed(1)} A${pieceR-2},${pieceR-2} 0 0,1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`}
                  fill={col} stroke="#1a1810" strokeWidth="0.8"
                />
              );
            })}
            <text x={x} y={y + pieceR + 9} textAnchor="middle" fontSize="6.5" fill="#7a7060">
              {corner.name}
            </text>
          </g>
        );
      })}

      {/* Edges */}
      {EDGES_3.map((edge, i) => {
        const { x, y } = edgePos(i);
        const colors = edge.stickers.map(s => stickerColor(s));
        const isSolved = isEdgeSolved(edge.stickers);
        return (
          <g key={edge.name}>
            <rect
              x={x - 10} y={y - 6} width={20} height={12} rx="3"
              fill="#1a1810"
              stroke={isSolved ? '#444' : '#FF5800'}
              strokeWidth={isSolved ? 1 : 2}
            />
            {/* Two halves */}
            <rect x={x - 10} y={y - 6} width={10} height={12} rx="2"
              fill={colors[0]} stroke="#1a1810" strokeWidth="0.5" />
            <rect x={x} y={y - 6} width={10} height={12} rx="2"
              fill={colors[1]} stroke="#1a1810" strokeWidth="0.5" />
            <text x={x} y={y + 15} textAnchor="middle" fontSize="6" fill="#7a7060">
              {edge.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Permutation Trace "How it works" toggle ─────────────────────────────────


function PermTraceExplainer({ stickers }) {
  return (
    <>
      <p>
        Sticker slots are numbered face by face, and labels like
        <span className="math-mono"> U12</span> name a face and a slot on it. A turn is a
        permutation σ of the {stickers} slots: it moves stickers in rings, written
        <span className="math-mono"> (a b c)</span> for a→b→c→a.
      </p>
      <p>
        Each row composes one more turn into the running product σ₁·σ₂·…·σₖ (first σ₁, then σ₂).
        A k-cycle is k−1 swaps, so parity is even or odd by the total count.
      </p>
    </>
  );
}


function StatChip({ label, tooltip, value, color }) {
  return (
    <div className="stat-chip" title={tooltip}>
      <span className="chip-label">{label}</span>
      <span className="chip-value" style={color ? { color } : {}}>{value}</span>
    </div>
  );
}

function ConceptCard({ title, math, desc, open }) {
  return (
    <div className="concept-card">
      <div className="concept-title">{title}</div>
      <div className="concept-math">{math}</div>
      {open && <div className="concept-desc">{desc}</div>}
    </div>
  );
}
