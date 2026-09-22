import { useMemo, useState, useCallback } from 'react';
import {
  permToCycles, solvedState, analyzeSequence, isSolved,
  getTurnPositionCycles, formatCycles,
  FACE_NAMES, COLORS,
} from '../lib/cubeState';

// ── Size-specific Group Theory text ──────────────────────────────────────────

const ORDER_DESCS = {
  2: "How many times you repeat a sequence before the cube returns to start. The 2×2 has only corners, so cycle lengths are LCMs of corner cycles. R U on the 2×2 has order 105 (same corner permutation as 3×3 since R U only touches corners).",
  3: "How many times you repeat the same sequence before the cube returns to where it started. For R U, the order is 105 — doing it 105 times lands back on solved. For 3×3, order is always ≤1260.",
  4: "The 4×4 introduces inner-layer moves (2R, 2U…). These interact with center and edge pieces in new ways, producing much larger orders. A single move combo like R 2R U can have order in the thousands.",
  5: "The 5×5 has three center layers per axis. Orders of move combinations grow dramatically — inner slice moves create long cycles across the 25-sticker centers, pushing orders into the tens of thousands.",
};

const GROUP_SIZE_MATH = {
  2: "|G₂| ≈ 3.7 × 10⁶",
  3: "|G₃| ≈ 4.3 × 10¹⁹",
  4: "|G₄| ≈ 7.4 × 10⁴⁵",
  5: "|G₅| ≈ 2.8 × 10⁷⁴",
};

const GROUP_SIZE_DESCS = {
  2: "The 2×2 has 3,674,160 reachable states — just 8 corners, no edges or centers. God's Number is 11 moves (HTM). Small enough that the full state space can be traversed in seconds.",
  3: "The 3×3 has 43 quintillion reachable states. Despite this, any scramble can be solved in ≤20 moves (God's Number, proven 2010). The group is a highly constrained subgroup of S₅₄.",
  4: "The 4×4 has ≈7.4 × 10⁴⁵ states — vastly more than the 3×3. God's Number is estimated ≈35 moves. The group includes centers and 'wing' edges that don't exist in the 3×3.",
  5: "The 5×5 has ≈2.8 × 10⁷⁴ states. God's Number is estimated ≈46 moves. Its group includes three layers of center pieces per axis and 'wing' edge pairs, making it exponentially larger than the 3×3.",
};

const STICKER_COUNTS = { 2: 24, 3: 54, 4: 96, 5: 150 };
const PIECE_COUNTS = {
  2: "8 corners, 0 edges, 0 centers",
  3: "8 corners, 12 edges, 6 centers",
  4: "8 corners, 24 wings, 24 centers",
  5: "8 corners, 24 wings, 24 + 9 centers",
};

/**
 * AlgebraPanel
 * Props:
 *   state: 6×N×N cube state
 *   size: N
 *   moveHistory: quarter turns [{notation, face, layers, cw}, ...] since reset/scramble
 *   solvePath: every quarter turn since the last solved state (scramble + moves),
 *              which pins down the exact sticker permutation
 *   algorithmNote: { groupTheoryNote, algebraNote, order, refs } | null
 */
export default function AlgebraPanel({ state, size = 3, moveHistory = [], solvePath = [], algorithmNote = null }) {
  const N = size;

  // Track which trace rows have their cycle string expanded
  const [expandedRows, setExpandedRows] = useState({});
  const toggleRow = useCallback((i) => {
    setExpandedRows(prev => ({ ...prev, [i]: !prev[i] }));
  }, []);

  // ── Current permutation, exact: compose every turn since solved ───────
  // (Colors alone cannot tell identical stickers apart on big cubes.)
  const perm   = useMemo(() => analyzeSequence(solvePath, N).perm, [solvePath, N]);
  const cycles = useMemo(() => permToCycles(perm, true), [perm]);
  const looksSolved = isSolved(state);

  const movedCount = cycles.reduce((a, c) => a + c.length, 0);
  const cycleTypes = {};
  cycles.forEach(c => { cycleTypes[c.length] = (cycleTypes[c.length] || 0) + 1; });
  const cycleTypeStr = Object.entries(cycleTypes)
    .sort(([a], [b]) => +a - +b)
    .map(([len, cnt]) => cnt > 1 ? `${cnt}×(${len}-cycle)` : `(${len}-cycle)`)
    .join(' ∘ ');
  const parity = cycles.reduce((s, c) => s + c.length - 1, 0) % 2 === 0 ? 'Even' : 'Odd';

  // ── Janet Chen trace: accumulate permutation step-by-step ─────────────
  // Each entry: {notation, moveCycles, cumCycles, cumParity}
  const trace = useMemo(() => {
    if (moveHistory.length === 0) return [];
    const nn = N * N;
    const total = 6 * nn;
    let perm = Array.from({ length: total }, (_, i) => i);
    const result = [];

    for (const turn of moveHistory) {
      const { notation } = turn;
      const moveCycles = getTurnPositionCycles(turn, N);
      const newPerm = [...perm];
      moveCycles.forEach(([a, b, c, d]) => {
        newPerm[b] = perm[a];
        newPerm[c] = perm[b];
        newPerm[d] = perm[c];
        newPerm[a] = perm[d];
      });
      perm = newPerm;
      // Decompose current cumulative perm into cycles
      const visited = new Uint8Array(total);
      const cumCycles = [];
      for (let s = 0; s < total; s++) {
        if (visited[s] || perm[s] === s) { visited[s] = 1; continue; }
        const cycle = [];
        let cur = s;
        while (!visited[cur]) {
          visited[cur] = 1;
          cycle.push(cur);
          cur = perm[cur];
        }
        if (cycle.length > 1) cumCycles.push(cycle);
      }
      const cumParity = cumCycles.reduce((s, c) => s + c.length - 1, 0) % 2 === 0 ? 'even' : 'odd';

      // Format move's own cycles (just the 4-cycles for this move)
      const moveCycleStr = formatCycles(moveCycles.slice(0, 3), N) +
        (moveCycles.length > 3 ? `···+${moveCycles.length-3}` : '');

      const cumCycleStrFull = formatCycles(cumCycles, N);
      result.push({
        notation,
        moveCycleStr,
        cumCycleStr: formatCycles(cumCycles.slice(0, 4), N) +
          (cumCycles.length > 4 ? ` ···+${cumCycles.length-4}` : ''),
        cumCycleStrFull,
        cumParity,
        cumCycleCount: cumCycles.length,
        cumMovedCount: cumCycles.reduce((s, c) => s + c.length, 0),
        hasMore: cumCycles.length > 4,
      });
    }
    return result;
  }, [moveHistory, N]);

  return (
    <div className="algebra-panel">
      <h3 className="panel-title"><span className="icon">σ</span> Abstract Algebra</h3>

      {/* ── Big picture intro ── */}
      <div className="algebra-intro-card">
        <div className="aic-title">Why is the Rubik's Cube a math object?</div>
        <p className="aic-body">
          A <strong>group</strong> is a set of elements with a composition rule (like multiplication)
          that satisfies four axioms: closure, associativity, identity, and inverses. The set of all
          legal cube states — about 43 quintillion — forms exactly such a group under move composition.
          Every face turn is a <em>group element</em>; applying two moves is <em>group multiplication</em>;
          and undoing a move is taking its <em>inverse</em>.
        </p>
        <p className="aic-body">
          Because every move just shuffles the 54 colored stickers around, each group element is
          a <em>permutation</em>. The cube group is therefore a subgroup of S₅₄ — the symmetric group
          on 54 elements — but a very constrained one: not every shuffle of 54 stickers is reachable
          by legal moves. The stats below show the permutation structure of your current state live.
        </p>
      </div>

      {/* ── Plain-English glossary ── */}
      <div className="algebra-section">
        <div className="section-label">What do these terms mean?</div>
        <div className="glossary-grid">
          <GlossaryCard
            term="Sticker"
            color="var(--accent2)"
            plain={`Each colored square on the cube. A 3×3 has 54 stickers (9 per face × 6 faces). When you make a move, stickers change position — group theory tracks exactly which sticker goes where.`}
          />
          <GlossaryCard
            term="Cycle"
            color="#fbbf24"
            plain={`A "rotation ring" of stickers. If R moves sticker A→B, B→C, C→D, D→A, that's a 4-cycle: every sticker in the ring takes the next one's spot. One face turn creates several such rings simultaneously.`}
          />
          <GlossaryCard
            term="Parity"
            color="#6ee7b7"
            plain={`Any shuffle can be broken into two-sticker swaps. If you need an even number of swaps, the permutation is even (parity = even); odd number of swaps → odd parity. On a 3×3 every quarter turn is odd on the 54 stickers, so sticker parity just counts quarter turns. The real constraint is on pieces: the corner and edge permutations always have the same parity, which is why you can't swap just two edges.`}
          />
        </div>
      </div>

      {/* ── Current state summary ── */}
      <div className="algebra-section">
        <div className="section-label">Current position — live stats</div>
        <div className="algebra-stat-row">
          <StatChip
            label="Stickers moved"
            tooltip={`How many of the ${6 * N * N} stickers are not in their starting position (tracked exactly through every turn)`}
            value={movedCount}
          />
          <StatChip
            label="Parity"
            tooltip="Parity of the sticker permutation. A quarter turn's parity is (−1)^(number of its 4-cycles)."
            value={parity}
            color={parity === 'Even' ? '#6ee7b7' : '#f87171'}
          />
          <StatChip
            label="Disjoint cycles"
            tooltip="How many independent rotation rings exist in the current permutation"
            value={cycles.length}
          />
        </div>
        {cycleTypeStr && (
          <div className="cycle-type-str">
            <span className="math-mono">σ = {cycleTypeStr || 'id'}</span>
            <span className="cycle-type-plain"> — the cycle structure of the current permutation</span>
          </div>
        )}
        {cycles.length === 0 && (
          <div className="solved-note">✓ Identity element — every sticker is home. Cube is solved.</div>
        )}
        {cycles.length > 0 && looksSolved && (
          <div className="solved-note">
            ✓ Looks solved, yet {movedCount} stickers sit in other positions of the same color.
            This is not the identity: it is an element of the stabilizer of the solved coloring,
            such as a whole-cube rotation or identical-looking stickers trading places.
          </div>
        )}
      </div>

      {/* ── Janet Chen permutation trace ── */}
      {trace.length > 0 && (
        <div className="algebra-section">
          <div className="section-label" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{ flex: 1 }}>Move-by-move permutation trace</span>
            <PermTraceToggle />
          </div>
          <div className="diagram-note" style={{marginBottom: '8px'}}>
            Following <strong>Janet Chen's approach</strong>: each face move is a permutation σ on
            the 54 stickers. Compose them left-to-right and watch the group element evolve.
            Labels like <span className="math-mono">U12</span> = face U, row 1, col 2.
            A 4-cycle <span className="math-mono">(a b c d)</span> means a→b→c→d→a.
            {' '}<em>A quarter turn's sticker parity is (−1)^(number of its 4-cycles); the Graph Theory tab breaks this down per orbit.</em>
          </div>
          <div className="perm-trace">
            <div className="perm-trace-row perm-trace-header">
              <span className="pt-move">Move</span>
              <span className="pt-cycles">Cumulative cycles</span>
              <span className="pt-meta"># cycles</span>
              <span className="pt-parity">Parity</span>
            </div>
            <div className="perm-trace-row perm-trace-identity">
              <span className="pt-move">start</span>
              <span className="pt-cycles math-mono">identity (solved)</span>
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
          <div className="diagram-note" style={{marginTop:'6px'}}>
            This is Janet Chen's approach: represent each face move as a permutation on the 54 stickers, then compose them left-to-right to see the evolving group element.
          </div>
        </div>
      )}

      {/* ── Algorithm-specific note ── */}
      {algorithmNote && (
        <div className="algebra-section alg-note">
          {algorithmNote.algebraNote && (
            <div className="math-notation">{algorithmNote.algebraNote}</div>
          )}
          {algorithmNote.order && (
            <div className="order-badge">Order: {algorithmNote.order}</div>
          )}
          {algorithmNote.groupTheoryNote && (
            <p className="theory-text">{algorithmNote.groupTheoryNote}</p>
          )}
          {algorithmNote.refs && algorithmNote.refs.length > 0 && (
            <div className="refs">
              <span className="refs-label">Refs: </span>
              {algorithmNote.refs.map((ref, i) => (
                <span key={i}>
                  {ref.url
                    ? <a href={ref.url} target="_blank" rel="noreferrer">{ref.label}</a>
                    : <span className="ref-inline">{ref.label}</span>}
                  {i < algorithmNote.refs.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Cycle chord diagram ── */}
      <div className="algebra-section">
        <div className="section-label">Cycle chord diagram — permutation visualised</div>
        <div className="diagram-note" style={{marginBottom: 8}}>
          Each dot is one of the {6 * N * N} sticker positions ({PIECE_COUNTS[N] || `6×${N}² = ${6*N*N} stickers`}),
          arranged in 6 face groups around a circle.
          Arcs connect positions that form a cycle — same color arc = same cycle.
          The identity (solved state) shows no arcs.
        </div>
        <CycleChordDiagram cycles={cycles} N={N} />
      </div>

      {/* ── Piece orbit diagram ── */}
      <div className="algebra-section">
        <div className="section-label">Piece orbit diagram — corners &amp; edges</div>
        <div className="diagram-note" style={{marginBottom: 8}}>
          The cube group has two independent orbits: the <strong>8 corners</strong> (outer ring) and
          the <strong>12 edges</strong> (inner ring). Each node shows the sticker colors of the piece
          currently in that slot. A colored outline means the piece is out of place.
        </div>
        <PieceOrbitDiagram state={state} N={N} />
      </div>

      {/* ── Key concepts ── */}
      <div className="algebra-section concepts">
        <div className="section-label">Group Theory toolkit</div>
        <div className="concept-grid">
          <ConceptCard
            title="Commutator"
            math="[A,B] = ABA⁻¹B⁻¹"
            desc="Do move A, then B, then undo A, then undo B. If A and B don't commute, you get a small, targeted change. Most cube algorithms are commutators — they isolate the effect to just a few pieces."
            footnote="Chen §5"
          />
          <ConceptCard
            title="Conjugate"
            math="ABA⁻¹"
            desc="Setup with A, apply algorithm B, undo the setup. This 'teleports' B's effect to a new location without moving everything else. Think of it as repositioning before striking."
            footnote="Chen §4"
          />
          <ConceptCard
            title="Order"
            math="|g| = min k : gᵏ = identity"
            desc={ORDER_DESCS[N] || ORDER_DESCS[3]}
            footnote="Lagrange's theorem"
          />
          <ConceptCard
            title={`Group size  |G${N > 3 ? N : '₃'}|`}
            math={GROUP_SIZE_MATH[N] || GROUP_SIZE_MATH[3]}
            desc={GROUP_SIZE_DESCS[N] || GROUP_SIZE_DESCS[3]}
            footnote="cube20.org"
          />
        </div>
      </div>
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

function CycleChordDiagram({ cycles, N }) {
  const total = 54; // always 6×3×3 for display purposes — works for all N but scaled
  const R = 88, cx = 110, cy = 110;
  const r = 5; // dot radius

  // Position of index i on the circle
  const pos = (i, total) => {
    const angle = (2 * Math.PI * i / total) - Math.PI / 2;
    return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
  };

  // Build dot colors by face group
  const dotColors = Array.from({ length: total }, (_, i) => {
    const face = Math.floor(i / 9);
    return FACE_COLORS_HEX[face] || '#888';
  });

  // Build arcs for each cycle
  const arcs = [];
  cycles.slice(0, 20).forEach((cycle, ci) => {
    const color = CYCLE_PALETTE[ci % CYCLE_PALETTE.length];
    // Only draw arcs for indices that fit in our 54-position display
    const mapped = cycle.map(idx => Math.round(idx * total / (N * N * 6)));
    for (let i = 0; i < mapped.length; i++) {
      const a = mapped[i], b = mapped[(i + 1) % mapped.length];
      if (a >= total || b >= total) continue;
      const pa = pos(a, total), pb = pos(b, total);
      // Quadratic bezier pulling toward center
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      const pull = 0.45;
      const qx = cx + (mx - cx) * pull, qy = cy + (my - cy) * pull;
      arcs.push(<path key={`a${ci}-${i}`}
        d={`M${pa.x.toFixed(1)},${pa.y.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${pb.x.toFixed(1)},${pb.y.toFixed(1)}`}
        fill="none" stroke={color} strokeWidth="1.2" strokeOpacity="0.75"
      />);
    }
  });

  return (
    <svg width="220" height="220" style={{ display: 'block', margin: '0 auto' }}>
      {/* Face group labels */}
      {['U','R','F','D','L','B'].map((f, fi) => {
        const midIdx = fi * 9 + 4;
        const { x, y } = pos(midIdx, total);
        const lx = cx + (x - cx) * 1.25, ly = cy + (y - cy) * 1.25;
        return <text key={f} x={lx} y={ly + 3} textAnchor="middle"
          fontSize="9" fill={FACE_COLORS_HEX[fi]} fontWeight="bold">{f}</text>;
      })}
      {/* Arcs */}
      {arcs}
      {/* Dots */}
      {Array.from({ length: total }, (_, i) => {
        const { x, y } = pos(i, total);
        const inCycle = cycles.some(c => {
          // Map cycle indices back approximately
          return c.some(ci => Math.round(ci * total / (N * N * 6)) === i);
        });
        return (
          <circle key={i} cx={x} cy={y} r={r}
            fill={dotColors[i]}
            stroke={inCycle ? '#fff' : '#333'}
            strokeWidth={inCycle ? 1.2 : 0.5}
            opacity={inCycle ? 1 : 0.45}
          />
        );
      })}
      {/* Center label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" fill="#7a7060">σ</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8" fill="#7a7060">
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

      {/* Ring labels */}
      <text x={cxS} y={cyS - Re + 14} textAnchor="middle" fontSize="8" fill="#7a7060">edges (12)</text>
      <text x={cxS} y={cyS + 5} textAnchor="middle" fontSize="8" fill="#7a7060">corners (8)</text>
      <text x={cxS} y={cyS + 16} textAnchor="middle" fontSize="8" fill="#7a7060">outer ring</text>

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

function PermTraceToggle() {
  const [open, setOpen] = useState(false);
  return (
    <span>
      <button
        className="pt-explain-btn"
        onClick={() => setOpen(o => !o)}
        title="How is this constructed?"
      >
        {open ? '▲ Hide' : '? How this works'}
      </button>
      {open && <PermTraceExplainer />}
    </span>
  );
}

function PermTraceExplainer() {
  return (
    <div className="pt-explainer">
      <div className="pte-title">How the permutation trace is built</div>

      <div className="pte-section">
        <div className="pte-label">① State representation</div>
        <p className="pte-body">
          The cube is stored as a <strong>6 × N × N array</strong>. Each cell holds a color
          index 0–5 (U=0 white, R=1 red, F=2 green, D=3 yellow, L=4 orange, B=5 blue).
          A sticker at face <em>f</em>, row <em>r</em>, column <em>c</em> gets a flat index:
        </p>
        <div className="pte-formula">idx = f·N² + r·N + c</div>
        <p className="pte-body">
          Labels like <span className="math-mono">U12</span> mean face U (f=0), row 1, col 2 → idx = 0·9 + 1·3 + 2 = 5.
          For a 3×3, there are 54 such positions (6 × 9).
        </p>
      </div>

      <div className="pte-section">
        <div className="pte-label">② A move as a permutation</div>
        <p className="pte-body">
          A face turn (say R) physically moves stickers around. We can represent it as a
          function σ : {'{0…53}'} → {'{0…53}'} where σ(i) = j means "the sticker currently
          at position i goes to position j." Since face turns always cycle stickers in groups
          of 4, σ decomposes into <strong>4-cycles</strong>:
        </p>
        <div className="pte-formula">(i₀ i₁ i₂ i₃) means i₀→i₁, i₁→i₂, i₂→i₃, i₃→i₀</div>
        <p className="pte-body">
          A single 3×3 R move creates 5 such 4-cycles: 2 on the R face itself (its 4 corner
          stickers and its 4 edge stickers) and 3 around the belt, one for each column of
          stickers on U, F, D and B.
        </p>
      </div>

      <div className="pte-section">
        <div className="pte-label">③ Composition = multiplication</div>
        <p className="pte-body">
          When you apply two moves A then B, the combined effect is the permutation
          <strong> B∘A</strong> (first A, then B). In the table, we track the running
          product left-to-right:
        </p>
        <div className="pte-formula">σ_total = σ₁ · σ₂ · … · σₖ</div>
        <p className="pte-body">
          Each new move's cycles are "merged" into the total via function composition:
          the new permutation maps position i to wherever A's output ends up after B
          acts on it. The table shows this evolving product after each move.
        </p>
      </div>

      <div className="pte-section">
        <div className="pte-label">④ Parity</div>
        <p className="pte-body">
          Any permutation can be decomposed into <strong>transpositions</strong> (2-swaps).
          A k-cycle requires k−1 transpositions. Add up all k−1 for every cycle in σ_total:
          if the sum is even → <span style={{color:'#6ee7b7'}}>even parity</span>; odd →
          <span style={{color:'#f87171'}}> odd parity</span>. Every 3×3 quarter turn is five
          4-cycles, so it is odd on stickers. The constraint that survives is on pieces: the
          corner and edge permutations always have equal parity, which is why you can't swap
          just two corners without affecting anything else.
        </p>
      </div>
    </div>
  );
}

function GlossaryCard({ term, color, plain }) {
  return (
    <div className="glossary-card">
      <div className="glossary-term" style={{ color }}>{term}</div>
      <div className="glossary-plain">{plain}</div>
    </div>
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

function ConceptCard({ title, math, desc, footnote }) {
  return (
    <div className="concept-card">
      <div className="concept-title">{title}</div>
      <div className="concept-math">{math}</div>
      <div className="concept-desc">{desc}</div>
      {footnote && <div className="concept-footnote">† {footnote}</div>}
    </div>
  );
}
