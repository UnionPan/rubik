import { useEffect, useMemo, useState } from 'react';
import Section from './ui/Section';
import DistanceChart from './DistanceChart';

// One short paragraph per puzzle: what the families mean for solving it
const TAKEAWAY = {
  cube2: 'The 2×2 has only corners, so all 24 stickers form one family. With no centers to hold it still, the whole cube can end up facing any way.',
  cube3: 'Corners and edges are separate families, so a corner can never turn into an edge. The six middle stickers are in no loop at all: no face turn moves them, so they decide each face\'s color.',
  cube4: 'Edge stickers split into two mirror-image families, and every edge piece has one sticker in each. So no sequence can flip a single edge piece in place. An inner-layer quarter turn shuffles each of those families in an odd way and outer turns never do, which is where the 4×4\'s parity cases come from.',
  cube5: 'The middle edges and the fixed centers behave exactly like a 3×3\'s edges and centers. That is why big cubes are solved by first making them look like a 3×3.',
  ivy: 'Each corner only twists in place, so its three stickers are a small family of their own. The six leaves form one family. Every turn moves things in loops of 3, so two leaves can never simply trade places: half of all leaf arrangements are impossible.',
  diamond: 'Corner pieces never flip a single sticker, so corner stickers split into two families. Four of the centers move as one family; the other four never move. Every turn moves things in loops of 3, so two pieces can never simply trade places.',
};

/**
 * GraphsPanel - the Graphs view of the Math tab, for every puzzle: the
 * facelet graph explained in three pictures, the families (orbits) of the
 * current position, and, for puzzles small enough to enumerate, every
 * position by distance from solved.
 */
export default function GraphsPanel({
  model, state, lastMove, focusOrbit, onFocusOrbit, graphVisible, onShowGraph, onTurn, oracle = null,
}) {
  const { graph } = model;
  const isCube = model.kind === 'cube';
  const families = graph.orbits.filter(o => o.kind !== 'fixed');
  const fixed = graph.orbits.find(o => o.kind === 'fixed');
  const loopLength = isCube ? 4 : 3;

  const homeColor = useMemo(() => {
    const solved = model.solvedState();
    return graph.nodes.map(n => graph.colorOf(solved, n.i));
  }, [model, graph]);
  const home = useMemo(() => Object.fromEntries(families.map(o => [
    o.id, o.members.filter(i => graph.colorOf(state, i) === homeColor[i]).length,
  ])), [families, graph, state, homeColor]);

  const desc = useMemo(() => (lastMove ? graph.describeTurn(lastMove) : null), [graph, lastMove]);
  const tryName = isCube ? 'R' : model.axes[0].name;
  const tryIt = () => {
    const [turn] = model.parseMoveSequence(tryName);
    onShowGraph();
    onTurn({ ...turn, notation: model.turnToNotation ? model.turnToNotation(turn) : tryName });
  };

  // Distance of the current position from solved (enumerated puzzles only)
  const info = oracle?.info ?? null;
  const [distance, setDistance] = useState(null);
  useEffect(() => {
    if (!info) return undefined;
    let current = true;
    oracle.query(state).then(a => { if (current) setDistance(a.distance); });
    return () => { current = false; };
  }, [oracle, info, state]);

  const colors = [0, 1, 2].map(f => model.colors[f]);

  return (
    <div className="panel-stack">
      <Section title={<><span className="story-num">1</span>Every sticker is a dot</>}
        aside={!graphVisible && <button className="ui-chip-btn" onClick={onShowGraph}>Show the graph</button>}>
        <div className="story">
          <StickersToDots colors={colors} />
          <p>
            The graph beside the {isCube ? 'cube' : 'puzzle'} draws each sticker as a dot of the same color.
            Dots from one face sit together around that face&apos;s letter.
          </p>
        </div>
      </Section>

      <Section title={<><span className="story-num">2</span>A turn slides dots around loops</>}>
        <div className="story">
          <LoopPicture colors={model.colors} length={loopLength} />
          <div>
            <p>
              Turning a layer carries its stickers around in rings. On the graph each ring is a faint
              circle, and the dots slide along it, {loopLength} to a ring.
            </p>
            <div className="story-try">
              <button className="tp-btn" onClick={tryIt}>Try {tryName}</button>
              {desc && (
                <span>
                  <strong>{desc.notation}</strong> moved {desc.total * (desc.cycleLength ?? 4)} stickers
                  around {desc.total} loop{desc.total === 1 ? '' : 's'}.
                </span>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section title={<><span className="story-num">3</span>Dots that can reach each other are a family</>}>
        <div className="story">
          <FamiliesPicture colors={families.slice(0, 2).map(o => o.color)} />
          <p>
            Follow the loops from any dot and you can only ever reach some of the other dots.
            Those dots are its family (mathematicians say <em>orbit</em>), and no sequence of turns can
            move a sticker out of it. Ring every dot in its family color with <strong>Families</strong> on the graph.
          </p>
        </div>
        <div className="family-list">
          {families.map(o => (
            <button key={o.id}
              className={`family-row${focusOrbit === o.id ? ' on' : ''}`}
              onClick={() => { onShowGraph(); onFocusOrbit(focusOrbit === o.id ? null : o.id); }}
              aria-pressed={focusOrbit === o.id}
              title="Show only this family on the graph"
            >
              <span className="gsl-ring" style={{ borderColor: o.color }} />
              <span className="family-name">{o.label}</span>
              <span className="family-bar"><span style={{ width: `${(home[o.id] / o.members.length) * 100}%`, background: o.color }} /></span>
              <span className="family-home">{home[o.id]} of {o.members.length} home</span>
            </button>
          ))}
          {fixed && (
            <div className="family-row family-fixed">
              <span className="gsl-ring" style={{ borderColor: fixed.color }} />
              <span className="family-name">{fixed.label}</span>
              <span className="family-home">never move</span>
            </div>
          )}
        </div>
        <p className="story-note">Click a family to see only its dots on the graph.</p>
      </Section>

      <Section title="What this tells you">
        <p className="story-text">{TAKEAWAY[model.id]}</p>
      </Section>

      {oracle && (
        <Section title="Every position">
          <p className="story-text">
            {info
              ? <>All {info.order.toLocaleString('en-US')} positions, grouped by how many turns they are from
                solved. The farthest are {info.godsNumber} turns away{distance != null && <>; yours is {distance}</>}.</>
              : 'Visiting every position…'}
          </p>
          {info && <DistanceChart distribution={info.distribution} current={distance} />}
        </Section>
      )}
    </div>
  );
}

/** Three stickers, an arrow, three dots */
function StickersToDots({ colors }) {
  return (
    <svg className="story-pic" viewBox="0 0 150 70" aria-hidden="true">
      {colors.map((c, i) => (
        <rect key={`s${i}`} x={6} y={6 + i * 20} width={17} height={17} rx={3} fill={c} stroke="#0c0b09" strokeWidth="1.5" />
      ))}
      <path d="M38 35 H98" stroke="#7a7060" strokeWidth="2" fill="none" />
      <path d="M94 30 L102 35 L94 40 Z" fill="#7a7060" />
      {colors.map((c, i) => (
        <circle key={`d${i}`} cx={128} cy={14.5 + i * 20} r={8.5} fill={c} stroke="#0c0b09" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/** A ring of dots stepping around it, like one loop of a turn */
function LoopPicture({ colors, length }) {
  const cx = 75, cy = 35, r = 26;
  const step = 360 / length;
  // Rest, then step one place around the ring; a full lap per `length` steps
  const name = `story-loop-${length}`;
  const frames = Array.from({ length }, (_, k) => {
    const t0 = (k / length) * 100, t1 = ((k + 0.55) / length) * 100;
    return `${t0.toFixed(2)}%{transform:rotate(${k * step}deg)}${t1.toFixed(2)}%{transform:rotate(${k * step}deg)}`;
  }).join('') + `100%{transform:rotate(360deg)}`;
  const at = (deg) => [cx + r * Math.cos((deg - 90) * Math.PI / 180), cy + r * Math.sin((deg - 90) * Math.PI / 180)];
  return (
    <svg className="story-pic" viewBox="0 0 150 70" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#5a5139" strokeWidth="1.5" />
      {Array.from({ length }, (_, k) => {
        const [x0, y0] = at(k * step + 22);
        const [x1, y1] = at((k + 1) * step - 22);
        return <path key={k} d={`M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`} fill="none" stroke="#ffb37a" strokeWidth="1.5" markerEnd="url(#story-arrow)" />;
      })}
      <defs>
        <marker id="story-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,1 L9,5 L0,9 z" fill="#ffb37a" />
        </marker>
      </defs>
      <style>{`@keyframes ${name}{${frames}} .${name}{transform-origin:${cx}px ${cy}px;animation:${name} ${1.6 * length}s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.${name}{animation:none}}`}</style>
      <g className={name}>
        {Array.from({ length }, (_, k) => {
          const [x, y] = at(k * step);
          return <circle key={k} cx={x} cy={y} r={7.5} fill={colors[k % colors.length]} stroke="#0c0b09" strokeWidth="1.5" />;
        })}
      </g>
    </svg>
  );
}

/** Two separate rings of dots that no loop joins */
function FamiliesPicture({ colors }) {
  const ring = (cx, color) => Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * 2 * Math.PI;
    return <circle key={k} cx={cx + 17 * Math.cos(a)} cy={35 + 17 * Math.sin(a)} r={5.5} fill="#1a1810" stroke={color} strokeWidth="2.5" />;
  });
  return (
    <svg className="story-pic" viewBox="0 0 150 70" aria-hidden="true">
      <circle cx={38} cy={35} r={17} fill="none" stroke="#5a5139" strokeWidth="1.2" />
      <circle cx={112} cy={35} r={17} fill="none" stroke="#5a5139" strokeWidth="1.2" />
      {ring(38, colors[0] ?? '#a78bfa')}
      {ring(112, colors[1] ?? colors[0] ?? '#60a5fa')}
      <path d="M68 35 H82" stroke="#7a7060" strokeWidth="1.5" strokeDasharray="2 3" />
      <path d="M71 31 L79 39 M79 31 L71 39" stroke="#f87171" strokeWidth="1.8" />
    </svg>
  );
}
