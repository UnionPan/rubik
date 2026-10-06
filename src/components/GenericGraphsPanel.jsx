import { useEffect, useMemo, useState } from 'react';
import Section from './ui/Section';
import DistanceChart from './DistanceChart';

/**
 * GenericGraphsPanel - the Graphs view of the Math tab for the
 * geometry-engine puzzles: the sticker graph, its orbits, parity, and the
 * whole Cayley graph (small enough to enumerate).
 */
export default function GenericGraphsPanel({
  model, state, focusOrbit, onFocusOrbit, graphVisible, onShowGraph, oracle,
}) {
  const { graph } = model;
  const orbits = model.orbits.filter(o => o.kind !== 'fixed');
  const fixed = model.orbits.find(o => o.kind === 'fixed');
  const info = oracle.info;
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    if (!info) return undefined;
    let current = true;
    oracle.query(state).then(a => { if (current) setDistance(a.distance); });
    return () => { current = false; };
  }, [oracle, info, state]);

  const home = useMemo(() => Object.fromEntries(model.orbits.map(o => [
    o.id, o.members.filter(i => state[i] === model.stickers[i].face).length,
  ])), [model, state]);

  return (
    <div className="panel-stack">
      <Section
        title={`The ${model.name} as a graph`}
        caption={`${graph.nodes.length} vertices, one per sticker; ${graph.circles.length} circles.`}
        aside={!graphVisible && <button className="ui-chip-btn" onClick={onShowGraph}>◎ Show graph</button>}
        why={<p>
          As with the cubes, every turn is a rigid rotation, so each sticker it moves travels along a
          circle around the turn&apos;s axis. The {model.axes.length} axes run through opposite corners of
          a cube, so the circles come in {model.axes.length} families.
        </p>}
      >
        <div className="gp-stat-row">
          <div className="gp-stat"><span className="gp-stat-v">{model.axes.length}</span><span className="gp-stat-l">axes</span></div>
          <div className="gp-stat"><span className="gp-stat-v">{graph.circles.length}</span><span className="gp-stat-l">circles</span></div>
          <div className="gp-stat"><span className="gp-stat-v">{graph.nodes.length}</span><span className="gp-stat-l">vertices</span></div>
        </div>
      </Section>

      <Section
        title="Orbits"
        caption="Where a sticker can ever go. Click to isolate."
        why={<p>
          {model.id === 'ivy'
            ? 'Each corner only twists in place, so its three stickers form an orbit of 3; the six leaves form one orbit and can reach every leaf slot.'
            : 'Corners have only two orientations, so the 24 corner stickers split into two orbits of 12. The four free centers form one orbit; the four fixed centers never move.'}
        </p>}
      >
        <div className="gp-table" role="table">
          <div className="gp-tr gp-th gp-tr-3" role="row">
            <span role="columnheader">Orbit</span>
            <span role="columnheader">size</span>
            <span role="columnheader">home</span>
          </div>
          {orbits.map(o => (
            <button key={o.id} role="row"
              className={`gp-tr gp-tr-3 gp-orbit-row${focusOrbit === o.id ? ' active' : ''}`}
              onClick={() => onFocusOrbit(focusOrbit === o.id ? null : o.id)}
              aria-pressed={focusOrbit === o.id}>
              <span role="cell" className="gp-orbit-name"><span className="gsl-ring" style={{ borderColor: o.color }} />{o.label}</span>
              <span role="cell" className="math-mono">{o.members.length}</span>
              <span role="cell" className="gp-bar-cell">
                <span className="gp-bar"><span className="gp-bar-fill" style={{ width: `${(home[o.id] / o.members.length) * 100}%`, background: o.color }} /></span>
                <span className="math-mono gp-bar-num">{home[o.id]}/{o.members.length}</span>
              </span>
            </button>
          ))}
          {fixed && (
            <div className="gp-tr gp-tr-3 gp-fixed-row" role="row">
              <span role="cell" className="gp-orbit-name"><span className="gsl-ring" style={{ borderColor: fixed.color }} />{fixed.label}</span>
              <span role="cell" className="math-mono">{fixed.members.length} × 1</span>
              <span role="cell" className="gp-muted">fixed</span>
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Parity"
        caption="Every turn is a product of 3-cycles: even on every orbit."
        why={<p>
          A 3-cycle is two swaps, so it is even. Every reachable position is a product of turns, so it
          is an even permutation on every orbit. That is why the position count has the factor ½:
          {model.id === 'ivy'
            ? ' the six leaves make only 6!/2 = 360 of their 720 permutations.'
            : ' corners and free centers each make only even permutations, and corners flip only in pairs.'}
        </p>}
      >
        <div className="gp-sign-table" style={{ gridTemplateColumns: `auto repeat(${orbits.length}, 1fr)` }}>
          <span className="gp-sign-head">turn</span>
          {orbits.map(o => (
            <span key={o.id} className="gp-sign-head" title={o.label}>
              <span className="gsl-ring" style={{ borderColor: o.color }} />{o.label.replace(/^Corner /, '')}
            </span>
          ))}
          {model.axes.map(axis => (
            <SignRow key={axis.name} axis={axis} orbits={orbits} model={model} />
          ))}
        </div>
      </Section>

      <Section
        title="Cayley graph"
        caption={info
          ? `All ${info.order.toLocaleString('en-US')} positions, by distance from solved. God's number is ${info.godsNumber}.`
          : 'Visiting every position…'}
        why={<p>
          One vertex per position, one edge per turn. The site visits every position by breadth-first
          search from solved: layer k holds the positions exactly k turns away. The deepest layer is
          God&apos;s number, and the highlighted layer is where your puzzle is now. The solver walks
          back down these layers, one turn per layer, which is why its solutions are optimal.
        </p>}
      >
        {info && <DistanceChart distribution={info.distribution} current={distance} />}
      </Section>
    </div>
  );
}

function SignRow({ axis, orbits, model }) {
  const cycles = model.moves[axis.index * 2].cycles;
  return (
    <>
      <span className="gp-sign-label math-mono">{axis.name}</span>
      {orbits.map(o => {
        const n = cycles.filter(c => model.graph.nodes[c[0]].orbit === o.id).length;
        return (
          <span key={o.id} className={`gp-sign ${n ? 'even' : 'gp-muted'}`} title={`${n} three-cycle${n === 1 ? '' : 's'}`}>
            {n ? '+1' : '·'}
          </span>
        );
      })}
    </>
  );
}
