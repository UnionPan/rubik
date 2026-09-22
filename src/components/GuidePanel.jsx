/**
 * GuidePanel — multi-page beginner walkthrough
 * 5 pages: Group → Generators → Permutations → Commutators → Parity
 */
import { useState } from 'react';

const PAGES = [
  { id: 'group',       title: '① The Group',            emoji: '⟳' },
  { id: 'generators',  title: '② Generators',           emoji: '⬡' },
  { id: 'perms',       title: '③ Permutations',         emoji: 'σ' },
  { id: 'commutator',  title: '④ Commutators',          emoji: '[·,·]' },
  { id: 'parity',      title: '⑤ Parity & Subgroups',   emoji: '±' },
];

export default function GuidePanel({ onNavigate }) {
  const [page, setPage] = useState(0);
  const P = PAGES[page];

  return (
    <div className="guide-panel">
      {/* Page indicator */}
      <div className="guide-pager">
        {PAGES.map((p, i) => (
          <button
            key={p.id}
            className={`gp-dot ${i === page ? 'active' : ''}`}
            onClick={() => setPage(i)}
            title={p.title}
          />
        ))}
      </div>

      {/* Page title */}
      <div className="guide-page-title">
        <span className="gpt-emoji">{P.emoji}</span>
        <span className="gpt-text">{P.title}</span>
      </div>

      {/* Page content */}
      <div className="guide-page-body">
        {page === 0 && <PageGroup />}
        {page === 1 && <PageGenerators />}
        {page === 2 && <PagePermutations />}
        {page === 3 && <PageCommutators />}
        {page === 4 && <PageParity />}
      </div>

      {/* Navigation */}
      <div className="guide-nav">
        <button
          className="guide-nav-btn"
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
        >← Prev</button>
        <span className="guide-nav-count">{page + 1} / {PAGES.length}</span>
        {page < PAGES.length - 1
          ? <button className="guide-nav-btn primary" onClick={() => setPage(p => p + 1)}>Next →</button>
          : <button className="guide-nav-btn primary" onClick={() => onNavigate?.('moves')}>Start Exploring →</button>
        }
      </div>
    </div>
  );
}

// ── Page 1: The Group ──────────────────────────────────────────────────────

function PageGroup() {
  return (
    <div className="guide-content">
      <p className="gc-lead">
        The Rubik's Cube is not just a puzzle — it is a <strong>mathematical group</strong>.
        Every scramble is an element, every move is an operation.
      </p>

      <div className="gc-card">
        <div className="gc-card-title">What is a group?</div>
        <p className="gc-body">
          A group is a set G with an operation (here: "apply move then move") satisfying four laws:
        </p>
        <div className="gc-axiom-list">
          <div className="gc-axiom">
            <span className="gc-axiom-name">Closure</span>
            <span className="gc-axiom-body">Applying two legal moves gives another legal position. You can't escape G.</span>
          </div>
          <div className="gc-axiom">
            <span className="gc-axiom-name">Associativity</span>
            <span className="gc-axiom-body">(A·B)·C = A·(B·C). Order of grouping doesn't matter, only order of moves.</span>
          </div>
          <div className="gc-axiom">
            <span className="gc-axiom-name">Identity</span>
            <span className="gc-axiom-body">The solved cube is the identity element e. Applying e does nothing.</span>
          </div>
          <div className="gc-axiom">
            <span className="gc-axiom-name">Inverses</span>
            <span className="gc-axiom-body">Every move has an inverse (R′ undoes R). Every scramble is solvable.</span>
          </div>
        </div>
      </div>

      <GroupSizeViz />

      <p className="gc-body" style={{marginTop: 12}}>
        The full 3×3 Rubik's Cube group G has exactly <strong>43,252,003,274,489,856,000</strong> elements
        (≈ 4.3 × 10¹⁹). Despite this, any scramble can be solved in ≤ 20 moves — proven in 2010 using
        2.8 years of CPU time donated by Google.
      </p>
    </div>
  );
}

function GroupSizeViz() {
  // Visual: bar chart comparing |G| for 2x2, 3x3, 4x4, 5x5 (log scale)
  const sizes = [
    { n: '2×2', log: 6.6,  label: '3.7×10⁶' },
    { n: '3×3', log: 19.6, label: '4.3×10¹⁹' },
    { n: '4×4', log: 45.9, label: '7.4×10⁴⁵' },
    { n: '5×5', log: 74.4, label: '2.8×10⁷⁴' },
  ];
  const maxLog = 80;
  return (
    <div className="gc-viz">
      <div className="gc-viz-title">Group size by cube dimension (log scale)</div>
      {sizes.map(s => (
        <div key={s.n} className="gc-bar-row">
          <span className="gc-bar-label">{s.n}</span>
          <div className="gc-bar-track">
            <div className="gc-bar-fill" style={{ width: `${(s.log / maxLog) * 100}%` }} />
          </div>
          <span className="gc-bar-value">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page 2: Generators ─────────────────────────────────────────────────────

function PageGenerators() {
  return (
    <div className="guide-content">
      <p className="gc-lead">
        You don't need 43 quintillion buttons. Just <strong>six moves</strong> generate the entire group.
      </p>

      <div className="gc-card">
        <div className="gc-card-title">Generators of G</div>
        <p className="gc-body">
          A <em>generating set</em> is a small collection of elements whose combinations
          (and inverses) can reach every element of the group.
          For the Rubik's Cube:
        </p>
        <div className="gen-grid">
          {[
            {f:'U', color:'#fff',    fg:'#000', desc:'Up face CW'},
            {f:'R', color:'#B71234', fg:'#fff', desc:'Right face CW'},
            {f:'F', color:'#009B48', fg:'#fff', desc:'Front face CW'},
            {f:'D', color:'#FFD500', fg:'#000', desc:'Down face CW'},
            {f:'L', color:'#FF5800', fg:'#fff', desc:'Left face CW'},
            {f:'B', color:'#0046AD', fg:'#fff', desc:'Back face CW'},
          ].map(g => (
            <div key={g.f} className="gen-chip-wrap">
              <div className="gen-chip" style={{background: g.color, color: g.fg}}>{g.f}</div>
              <span className="gen-desc">{g.desc}</span>
            </div>
          ))}
        </div>
        <p className="gc-body" style={{marginTop: 10}}>
          Each generator also has an inverse (U′, R′, …) and a square (U², R², …).
          Together these 18 moves generate all of G.
        </p>
      </div>

      <div className="gc-card">
        <div className="gc-card-title">Cayley graph idea</div>
        <p className="gc-body">
          Imagine a giant graph: each node is a cube state (43 quintillion nodes), and each edge is
          one generator move. This is the <strong>Cayley graph</strong> of G. Every path from the
          solved state (the center) through edges represents a move sequence. The diameter of this
          graph is 20 — the maximum number of edges you ever need.
        </p>
        <p className="gc-body">
          The <strong>facelet graph</strong> beside the cube is its small cousin: one node per
          sticker slot instead of per state. See the <strong>Graph Theory</strong> tab.
        </p>
        <CayleyMiniViz />
      </div>
    </div>
  );
}

function CayleyMiniViz() {
  // Tiny schematic Cayley graph (not the real one, just illustrative)
  const cx = 100, cy = 70, r = 55;
  const nodes = [
    { id: 'e', x: cx, y: cy, label: 'e', solved: true },
    { id: 'R', x: cx + r * Math.cos(-Math.PI/2), y: cy + r * Math.sin(-Math.PI/2), label: 'R' },
    { id: 'U', x: cx + r * Math.cos(-Math.PI/6), y: cy + r * Math.sin(-Math.PI/6), label: 'U' },
    { id: 'F', x: cx + r * Math.cos(Math.PI/6),  y: cy + r * Math.sin(Math.PI/6),  label: 'F' },
    { id: 'RU',x: cx + r * Math.cos(-5*Math.PI/6), y: cy + r * Math.sin(-5*Math.PI/6), label: "RU" },
    { id: 'RF',x: cx + r * Math.cos(5*Math.PI/6),  y: cy + r * Math.sin(5*Math.PI/6),  label: "RF" },
  ];
  const edges = [['e','R'],['e','U'],['e','F'],['R','RU'],['R','RF']];
  const colors = { R: '#B71234', U: '#fff', F: '#009B48', e: '#FF5800', RU: '#888', RF: '#888' };
  return (
    <svg width="200" height="140" style={{display:'block',margin:'8px auto 0'}}>
      {edges.map(([a,b], i) => {
        const na = nodes.find(n => n.id === a);
        const nb = nodes.find(n => n.id === b);
        return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="#3a3420" strokeWidth="1.5" />;
      })}
      {nodes.map(n => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.solved ? 10 : 7}
            fill={colors[n.id] || '#555'} stroke={n.solved ? '#FF5800' : '#444'} strokeWidth={n.solved ? 2 : 1} />
          <text x={n.x} y={n.y + 4} textAnchor="middle"
            fontSize={n.solved ? 8 : 6} fill={['e','U'].includes(n.id) ? '#000' : '#fff'}>
            {n.label}
          </text>
        </g>
      ))}
      <text x="100" y="135" textAnchor="middle" fontSize="9" fill="#666" fontStyle="italic">
        Schematic — real graph has 43 quintillion nodes
      </text>
    </svg>
  );
}

// ── Page 3: Permutations ──────────────────────────────────────────────────

function PagePermutations() {
  return (
    <div className="guide-content">
      <p className="gc-lead">
        Every cube state is a <strong>permutation</strong> of the 54 sticker positions.
        Group multiplication is just permutation composition.
      </p>

      <div className="gc-card">
        <div className="gc-card-title">Stickers as indices</div>
        <p className="gc-body">
          Number the 54 sticker positions 0–53: face <em>f</em>, row <em>r</em>, col <em>c</em> gets
          index <code>f·9 + r·3 + c</code>. A move is a bijection σ : {'{0…53}'} → {'{0…53}'}.
          The solved state is the identity permutation (σ(i) = i for all i).
        </p>
        <PermViz />
      </div>

      <div className="gc-card">
        <div className="gc-card-title">Cycle notation</div>
        <p className="gc-body">
          Instead of listing all 54 mappings, we write only the non-trivial ones as <em>cycles</em>.
          A <strong>k-cycle</strong> (a₀ a₁ … aₖ₋₁) means:
        </p>
        <div className="gc-formula">a₀ → a₁ → a₂ → … → aₖ₋₁ → a₀</div>
        <p className="gc-body">
          A single R turn on a 3×3 creates exactly <strong>7 independent 4-cycles</strong> on the
          sticker positions. Every face turn is a product of 4-cycles because each belt column and
          each face diagonal rotates in a ring of exactly 4 positions.
        </p>
        <p className="gc-body">
          The <strong>Group Theory</strong> tab shows the live cycle decomposition of your current
          cube state — go apply some moves and watch it update.
        </p>
      </div>
    </div>
  );
}

function PermViz() {
  // Show a small 6-element permutation as arrows to illustrate the idea
  const perm = [1, 3, 4, 0, 2, 5]; // example: 0→1→3→0, 2→4→2, 5 fixed
  const n = 6;
  const cx = (i) => 20 + i * 30;
  const colors = ['#fff','#B71234','#009B48','#FFD500','#FF5800','#0046AD'];
  return (
    <svg width="200" height="90" style={{display:'block',margin:'8px auto 0'}}>
      {/* source row */}
      {Array.from({length:n},(_,i) => (
        <g key={`s${i}`}>
          <circle cx={cx(i)} cy={20} r={11} fill={colors[i]} stroke="#444" strokeWidth="1" />
          <text x={cx(i)} y={24} textAnchor="middle" fontSize="9" fill={i===0||i===3?'#000':'#fff'}>{i}</text>
        </g>
      ))}
      {/* arrows */}
      {perm.map((dst,src) => src !== dst && (
        <path key={`a${src}`}
          d={`M${cx(src)},32 C${cx(src)},55 ${cx(dst)},55 ${cx(dst)},68`}
          fill="none" stroke={colors[src]} strokeWidth="1.2" strokeDasharray="3,2"
          markerEnd="url(#arr)"
        />
      ))}
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#666" />
        </marker>
      </defs>
      {/* dest row */}
      {perm.map((dst,src) => (
        <g key={`d${dst}`}>
          <circle cx={cx(dst)} cy={76} r={11} fill={colors[src]} stroke="#444" strokeWidth="1" />
          <text x={cx(dst)} y={80} textAnchor="middle" fontSize="9" fill={src===0||src===3?'#000':'#fff'}>{dst}</text>
        </g>
      ))}
      <text x="100" y="90" textAnchor="middle" fontSize="8" fill="#666">
        cycles: (0 1 3)(2 4)  — position 5 fixed
      </text>
    </svg>
  );
}

// ── Page 4: Commutators ────────────────────────────────────────────────────

function PageCommutators() {
  return (
    <div className="guide-content">
      <p className="gc-lead">
        Almost every useful Rubik's algorithm is secretly a <strong>commutator</strong> or
        <strong> conjugate</strong>. This is why they work without disturbing the rest of the cube.
      </p>

      <div className="gc-card">
        <div className="gc-card-title">Commutator [A, B] = ABA⁻¹B⁻¹</div>
        <p className="gc-body">
          The commutator measures how much A and B <em>fail to commute</em>. If A and B commuted
          perfectly (AB = BA), then ABA⁻¹B⁻¹ = identity — nothing happens. But for most cube moves
          they don't commute, so [A,B] produces a small, targeted change.
        </p>
        <CommutatorViz />
        <p className="gc-body" style={{marginTop: 8}}>
          The <strong>Sexy Move</strong> R U R′ U′ is the commutator [R, U]. Applying it 6 times
          returns the cube to solved (order 6). Its effect is a 3-cycle of corners — small and
          surgical precisely because of the commutator structure.
        </p>
      </div>

      <div className="gc-card">
        <div className="gc-card-title">Conjugate ABA⁻¹ — "teleporting" an algorithm</div>
        <p className="gc-body">
          A <em>conjugate</em> A·B·A⁻¹ takes algorithm B and "transports" its effect to a new
          location. Setup move A repositions the target pieces, B does the work, A⁻¹ restores
          everything else. This is the group-theoretic foundation of "setup moves" in speedcubing.
        </p>
        <div className="gc-formula">
          OLL T-shape = F · [R,U] · F⁻¹ — the commutator [R,U] conjugated by F
        </div>
      </div>
    </div>
  );
}

function CommutatorViz() {
  // 4-step diagram: do A, do B, undo A, undo B → net small change
  const steps = [
    { label: 'Start',   color: '#2a2a2a', note: 'identity' },
    { label: '→ A',     color: '#B71234', note: 'apply R' },
    { label: '→ B',     color: '#009B48', note: 'apply U' },
    { label: '→ A⁻¹',  color: '#B71234', note: "apply R'" },
    { label: '→ B⁻¹',  color: '#009B48', note: "apply U'" },
  ];
  return (
    <div className="comm-viz">
      {steps.map((s, i) => (
        <div key={i} className="cv-step">
          <div className="cv-node" style={{borderColor: s.color}}>{s.label}</div>
          {i < steps.length - 1 && <div className="cv-arrow">→</div>}
        </div>
      ))}
      <div className="cv-result">
        Net result: small 3-cycle (targeted change)
      </div>
    </div>
  );
}

// ── Page 5: Parity ─────────────────────────────────────────────────────────

function PageParity() {
  return (
    <div className="guide-content">
      <p className="gc-lead">
        Not every shuffle of 54 stickers is a legal cube state. The group G is a <strong>proper
        subgroup</strong> of S₅₄ — constrained by parity, orientation sums, and piece type.
      </p>

      <div className="gc-card">
        <div className="gc-card-title">Parity: the hidden constraint</div>
        <p className="gc-body">
          Any permutation can be decomposed into 2-swaps (transpositions). If the total number of
          swaps is even → <span style={{color:'#6ee7b7'}}>even permutation</span>; odd number →
          <span style={{color:'#f87171'}}> odd permutation</span>. A k-cycle requires k−1 transpositions.
        </p>
        <p className="gc-body">
          A face turn of the 3×3 moves stickers in five 4-cycles (two on the turning face, three
          around its belt). Each 4-cycle is 3 transpositions, so a turn is 15: <em>odd</em> on the
          stickers. The constraint that matters lives on the <em>pieces</em>: a quarter turn is one
          4-cycle of corners and one 4-cycle of edges, so it flips both parities at once.
        </p>
        <div className="gc-formula">
          sign(corner permutation) = sign(edge permutation)
        </div>
        <p className="gc-body">
          Consequence: you <strong>cannot</strong> swap just two corners or just two edges without
          also disturbing something else. Together with the orientation rules (corner twists sum to
          0 mod 3, edge flips to 0 mod 2), this is why "one corner twisted" or "two pieces swapped"
          is impossible without disassembly.
        </p>
      </div>

      <div className="gc-card">
        <div className="gc-card-title">Why 4×4 has parity cases</div>
        <p className="gc-body">
          An outer turn moves the 24 wing edges in two 4-cycles (<em>even</em>); an inner slice
          turn moves them in one 4-cycle (<em>odd</em>). So the wings' parity is set by the inner
          slices alone and is independent of the corners:
        </p>
        <div className="gc-formula">sign(wing permutation) = (−1)^(number of inner-slice quarter turns)</div>
        <p className="gc-body">
          An odd wing permutation shows up after reduction as <em>OLL parity</em>: a single flipped
          edge, which no 3×3 algorithm can fix. <em>PLL parity</em> (two swapped edges) breaks the
          other 3×3 rule, edge parity = corner parity; it is possible because identical-looking
          center pieces can hide an odd permutation. The Pattern Detector in the Algorithms tab
          checks both rules. The 5×5's wings follow the same rule.
        </p>
      </div>

      <div className="gc-callout">
        <span className="gc-callout-icon">→</span>
        Go to the <strong>Graph Theory</strong> tab and apply moves. The parity of each orbit
        updates live; on a 4×4, watch the wings flip only when you turn an inner slice.
      </div>
    </div>
  );
}
