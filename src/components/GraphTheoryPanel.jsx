import { useMemo } from 'react';
import Section from './ui/Section';
import { analyzeSequence } from '../lib/cubeState';
import {
  buildFaceletGraph, generatorSigns, orbitColorMatch, orbitDiameters,
  permByOrbit, describeMove, componentsAreRotationOrbits, moveCyclesByOrbit,
} from '../lib/faceletGraph';

const SIZES = [2, 3, 4, 5];
const GROUP_ORDERS = { 2: '3.7 × 10⁶', 3: '4.3 × 10¹⁹', 4: '7.4 × 10⁴⁵', 5: '2.8 × 10⁷⁴' };

// What the picture looks like for each size - the "corresponding graphical representation"
const SIZE_NOTES = {
  2: 'The 2×2 has only corners. Its graph is a single component of 24 vertices, and there is no fixed center, so nothing pins down the cube\'s orientation: every vertex can reach every other.',
  3: 'The 3×3 graph has 54 vertices: two components of 24 (corner facelets and edge facelets) plus 6 isolated vertices, the centers, which no face turn moves. A corner facelet can never land on an edge slot because no edge of the graph connects the two components.',
  4: 'The 4×4 graph has 96 vertices, 4 belts per axis, and no fixed centers. It splits into four components of 24: corners, centers, and two wing components that are mirror images of each other. A wing piece has one facelet in each wing component, and since no turn can move a facelet between components, a wing can never be flipped in place.',
  5: 'The 5×5 graph has 150 vertices in six components of 24 (corners, midges, two mirror-image wing components, X-centers and +-centers) plus the 6 fixed centers. Once the other components are solved, the midges and fixed centers are exactly a 3×3\'s edges and centers, which is the idea behind solving big cubes by reduction.',
};

/**
 * GraphTheoryPanel - explains the facelet graph and shows its group-theoretic
 * invariants for the current cube, live.
 */
export default function GraphTheoryPanel({
  state, size, moveHistory = [], focusOrbit, onFocusOrbit, lastMove, graphVisible, onShowGraph,
}) {
  const N = size;
  const graph = useMemo(() => buildFaceletGraph(N), [N]);
  const diameters = useMemo(() => orbitDiameters(graph), [graph]);
  const signs = useMemo(() => generatorSigns(graph), [graph]);
  const rotationCheck = useMemo(() => componentsAreRotationOrbits(graph), [graph]);
  const match = useMemo(() => orbitColorMatch(graph, state), [graph, state]);
  const lastDesc = useMemo(() => describeMove(graph, lastMove), [graph, lastMove]);

  const orbits = graph.orbits.filter(o => o.kind !== 'fixed');
  const fixed = graph.orbits.find(o => o.kind === 'fixed');
  const belts = graph.circles.filter(c => c.type === 'belt').length;
  const caps = graph.circles.length - belts;

  // One row per layer depth: all six faces at the same depth act alike by symmetry
  const signRows = signs.filter(r => r.face === 'R');

  // Cumulative permutation of the moves since the last reset/scramble, per orbit
  const cumulative = useMemo(() => {
    const { perm } = analyzeSequence(moveHistory, N);
    const byOrbit = permByOrbit(graph, perm);
    // Predicted parity: product of the generators' sign characters.  A wide
    // turn or rotation is a product of single-layer turns, one per layer.
    const predicted = {};
    graph.orbits.forEach(o => { predicted[o.id] = 1; });
    for (const turn of moveHistory) {
      for (const layer of turn.layers) {
        const counts = moveCyclesByOrbit(graph, turn.face, layer);
        graph.orbits.forEach(o => {
          if ((counts[o.id] || 0) % 2 === 1) predicted[o.id] *= -1;
        });
      }
    }
    return { byOrbit, predicted, count: moveHistory.length };
  }, [moveHistory, N, graph]);

  const family = useMemo(() => SIZES.map(n => {
    const g = buildFaceletGraph(n);
    const nontrivial = g.orbits.filter(o => o.kind !== 'fixed').length;
    const fixedCount = g.orbits.find(o => o.kind === 'fixed')?.members.length ?? 0;
    const beltCount = g.circles.filter(c => c.type === 'belt').length;
    return { n, vertices: g.nodes.length, nontrivial, fixedCount, belts: beltCount, caps: g.circles.length - beltCount };
  }), []);

  return (
    <div className="panel-stack">
      {/* ── The graph ── */}
      <Section
        title="The cube as a graph"
        caption={`${graph.nodes.length} vertices, one per sticker slot; ${graph.circles.length} circles.`}
        aside={!graphVisible && (
          <button className="ui-chip-btn" onClick={onShowGraph}>◎ Show graph</button>
        )}
        why={<>
          <p>
            For every turn <em>g</em>, draw an edge from each sticker slot <em>x</em> to <em>g(x)</em>.
            This is the <strong>Schreier graph</strong> of the cube group acting on sticker slots, and a
            cube state is a coloring of its vertices.
          </p>
          <p>
            The slots sit on a sphere so that every turn is a rigid rotation: each sticker it moves
            travels along a circle of latitude around the turn&apos;s axis. Projected from the hidden DLB
            corner, U, F, R form the middle and each axis gives one family of nested loops.
          </p>
        </>}
      >
        <div className="gp-stat-row">
          <div className="gp-stat"><span className="gp-stat-v">{belts}</span><span className="gp-stat-l">belt loops</span></div>
          <div className="gp-stat"><span className="gp-stat-v">{caps}</span><span className="gp-stat-l">cap loops</span></div>
          <div className="gp-stat"><span className="gp-stat-v">{graph.nodes.length}</span><span className="gp-stat-l">vertices</span></div>
        </div>
        {lastDesc && (
          <p className="gp-note">
            <span className="math-mono">{lastDesc.notation}</span> = {lastDesc.total} disjoint 4-cycles
            ({lastDesc.parts.map(p => `${p.count} ${p.label}`).join(', ')})
          </p>
        )}
      </Section>

      {/* ── Components = orbits ── */}
      <Section
        title="Orbits"
        caption="Connected components: where a sticker can ever go. Click to isolate."
        why={<>
          <p>
            Two slots are connected exactly when some sequence of turns carries one to the other,
            so the components are the <strong>orbits</strong> of the group. Each is also an orbit of
            the 24 rotations of the whole cube (O ≅ S₄), which fixes no slot except a face&apos;s middle
            one, so every orbit has 24 vertices: (N² − [N odd]) / 4 of them.
            {' '}<span className={rotationCheck ? 'gp-ok' : 'gp-bad'}>
              {rotationCheck ? '✓ Checked live for this cube.' : '✗ Live check failed.'}
            </span>
          </p>
          <p>Turns never mix orbits, so the group embeds in a product of symmetric groups:</p>
          <div className="pte-formula">
            G ↪ {orbits.map(o => 'S' + toSub(o.members.length)).join(' × ')}
          </div>
          <p>{SIZE_NOTES[N]}</p>
        </>}
      >
        <div className="gp-table" role="table">
          <div className="gp-tr gp-th" role="row">
            <span role="columnheader">Orbit</span>
            <span role="columnheader" title="Number of vertices">size</span>
            <span role="columnheader" title="Most quarter turns needed to move a sticker to any slot of its orbit">diam</span>
            <span role="columnheader" title="Slots showing their home color">home</span>
          </div>
          {orbits.map(o => {
            const m = match[o.id];
            const d = diameters[o.id];
            return (
              <button
                key={o.id}
                role="row"
                className={`gp-tr gp-orbit-row${focusOrbit === o.id ? ' active' : ''}`}
                onClick={() => onFocusOrbit(focusOrbit === o.id ? null : o.id)}
                aria-pressed={focusOrbit === o.id}
              >
                <span role="cell" className="gp-orbit-name">
                  <span className="gsl-ring" style={{ borderColor: o.color }} />{o.label}
                </span>
                <span role="cell" className="math-mono">{o.members.length}</span>
                <span role="cell" className="math-mono">{d.diameter}</span>
                <span role="cell" className="gp-bar-cell">
                  <span className="gp-bar"><span className="gp-bar-fill" style={{ width: `${(m.ok / m.total) * 100}%`, background: o.color }} /></span>
                  <span className="math-mono gp-bar-num">{m.ok}/{m.total}</span>
                </span>
              </button>
            );
          })}
          {fixed && (
            <div className="gp-tr gp-fixed-row" role="row">
              <span role="cell" className="gp-orbit-name"><span className="gsl-ring" style={{ borderColor: fixed.color }} />Face centers</span>
              <span role="cell" className="math-mono">6 × 1</span>
              <span role="cell" className="math-mono">0</span>
              <span role="cell" className="gp-muted">fixed</span>
            </div>
          )}
        </div>
      </Section>

      {/* ── Sign characters ── */}
      <Section
        title="Parity per orbit"
        caption="Sign of each turn on each orbit, and your moves so far."
        why={<>
          <p>
            On one orbit, a quarter turn is a product of 4-cycles, each odd, so its sign is
            (−1)<sup>#4-cycles</sup>. Sign is a homomorphism, so this table predicts the parity of any
            sequence on every orbit; ✓ marks where your moves match the prediction.
          </p>
          <p>{signInsight(N)}</p>
        </>}
      >
        <div className="gp-sign-table" style={{ gridTemplateColumns: `auto repeat(${orbits.length}, 1fr)` }}>
          <span className="gp-sign-head">turn</span>
          {orbits.map(o => (
            <span key={o.id} className="gp-sign-head" title={o.label}>
              <span className="gsl-ring" style={{ borderColor: o.color }} />{shortLabel(o.label)}
            </span>
          ))}
          {signRows.map(r => (
            <SignRow key={r.layer} row={r} orbits={orbits} graph={graph} />
          ))}
          <span className="gp-sign-label math-mono" title={`${cumulative.count} quarter turns since reset/scramble`}>
            yours ({cumulative.count})
          </span>
          {orbits.map(o => {
            const e = cumulative.byOrbit[o.id];
            const predicted = cumulative.predicted[o.id] > 0 ? 'even' : 'odd';
            return (
              <span key={o.id} className={`gp-sign ${e.parity}`}
                title={`${e.cycles.length ? cycleType(e.cycles) : 'identity'} · predicted ${predicted}`}>
                {e.parity === 'even' ? '+1' : '−1'}{e.parity === predicted ? ' ✓' : ' ✗'}
              </span>
            );
          })}
        </div>
      </Section>

      {/* ── Schreier vs Cayley ── */}
      <Section
        title="Schreier vs Cayley graph"
        why={<p>
          The Cayley graph has one vertex per cube <em>state</em> ({GROUP_ORDERS[N]} for the {N}×{N});
          its diameter is God&apos;s number, known for the 3×3 to be 20 in half turns and 26 in quarter
          turns. Fixing one sticker folds it down by the stabilizer of that sticker: the Schreier
          graph, 24 vertices per orbit instead.
        </p>}
      >
        <div className="concept-grid">
          <div className="concept-card">
            <div className="concept-title">Cayley graph</div>
            <div className="concept-math">one vertex per state · {GROUP_ORDERS[N]}</div>
          </div>
          <div className="concept-card">
            <div className="concept-title">Schreier graph</div>
            <div className="concept-math">one vertex per slot · diameter {Math.max(...diameters.map(d => d.diameter))}</div>
          </div>
        </div>
      </Section>

      {/* ── The N×N family ── */}
      <Section title="Every size" caption="Switch sizes in the header to compare.">
        <div className="gp-table gp-family" role="table">
          <div className="gp-tr gp-th" role="row">
            <span role="columnheader">cube</span>
            <span role="columnheader">vertices</span>
            <span role="columnheader">circles</span>
            <span role="columnheader">orbits</span>
          </div>
          {family.map(f => (
            <div key={f.n} role="row" className={`gp-tr${f.n === N ? ' current' : ''}`}>
              <span role="cell" className="math-mono">{f.n}×{f.n}</span>
              <span role="cell" className="math-mono">{f.vertices}</span>
              <span role="cell" className="math-mono">{f.belts} + {f.caps}</span>
              <span role="cell" className="math-mono">{f.nontrivial} × 24{f.fixedCount ? ` + ${f.fixedCount} × 1` : ''}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function SignRow({ row, orbits, graph }) {
  const counts = moveCyclesByOrbit(graph, row.face, row.layer);
  const label = row.layer === 0 ? 'outer (R)' : `slice (${row.layer + 1}R)`;
  return (
    <>
      <span className="gp-sign-label math-mono">{label}</span>
      {orbits.map(o => {
        const s = row.signs[o.id];
        const c = counts[o.id] || 0;
        return (
          <span key={o.id} className={`gp-sign ${s > 0 ? 'even' : 'odd'}`} title={`${c} four-cycle${c === 1 ? '' : 's'}`}>
            {s > 0 ? '+1' : '−1'}
          </span>
        );
      })}
    </>
  );
}

function signInsight(N) {
  switch (N) {
    case 2:
      return 'On the 2×2 every quarter turn is odd on the corner facelets, so their parity just counts quarter turns.';
    case 3:
      return 'On the 3×3 a face turn is odd on corner facelets (three 4-cycles) but even on edge facelets (two). So the corner-facelet parity counts your quarter turns, and the edge facelets are always even.';
    case 4:
      return 'On the 4×4 an outer turn is even on both wing components, while an inner slice turn is odd on each. So wing parity counts inner-slice quarter turns and is independent of the corners. That is where the 4×4\'s OLL parity comes from: after reducing to a 3×3, the wings can end up in an odd permutation that no outer turn can fix.';
    case 5:
      return 'On the 5×5, as on the 4×4, outer turns are even on each wing component and inner slice turns are odd, so wing parity again counts inner-slice quarter turns. The midges are untouched by inner slices and copy the 3×3 edges exactly.';
    default:
      return '';
  }
}

function shortLabel(label) {
  return label
    .replace('Corners', 'Crn').replace('Edges', 'Edg').replace('Midges', 'Mid')
    .replace('Wings', 'W').replace('X-centers', 'X').replace('+-centers', '+')
    .replace('Centers', 'Ctr');
}

function cycleType(lengths) {
  const counts = {};
  lengths.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
  return Object.entries(counts)
    .sort(([a], [b]) => +a - +b)
    .map(([len, cnt]) => (cnt > 1 ? `${len}${toSup(cnt)}` : len))
    .join(' · ');
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function toSub(n) { return String(n).split('').map(d => SUB[+d]).join(''); }
function toSup(n) { return String(n).split('').map(d => SUP[+d]).join(''); }
