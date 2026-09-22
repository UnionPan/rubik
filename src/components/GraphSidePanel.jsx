import { useMemo } from 'react';
import FaceletGraph from './FaceletGraph';
import { buildFaceletGraph, describeMove } from '../lib/faceletGraph';

/**
 * GraphSidePanel - the facelet graph shown beside the 3D cube, with a
 * readout of the current move as a permutation and an orbit legend.
 * Mount with key={size}.
 */
export default function GraphSidePanel({
  state, size, highlightFace, animateRef,
  focusOrbit, onFocusOrbit, showOrbits, onShowOrbits,
  move, onMoveChange, onClose, onExplain,
}) {
  const graph = useMemo(() => buildFaceletGraph(size), [size]);
  const desc = useMemo(() => describeMove(graph, move), [graph, move]);

  return (
    <div className="flatmap-side graph-side">
      <div className="flatmap-side-header">
        <span className="flatmap-side-title">Facelet graph</span>
        <span className="flatmap-side-hint">{graph.nodes.length} vertices · {graph.circles.length} circles</span>
        <button
          className={`gs-chip-btn${showOrbits ? ' active' : ''}`}
          onClick={() => onShowOrbits(!showOrbits)}
          aria-pressed={showOrbits}
          title="Ring each vertex with the color of its orbit (connected component)"
        >Orbits</button>
        <button className="gs-chip-btn" onClick={onExplain} title="Open the Graph Theory tab">?</button>
        <button className="flatmap-side-close" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="graph-side-body">
        <FaceletGraph
          state={state}
          size={size}
          highlightFace={highlightFace}
          animateRef={animateRef}
          focusOrbit={focusOrbit}
          onFocusOrbit={onFocusOrbit}
          showOrbits={showOrbits}
          onMoveChange={onMoveChange}
        />
      </div>

      <div className="graph-side-move" aria-live="polite">
        {desc ? (
          <>
            <span className="gsm-notation">{desc.notation}</span>
            <span className="gsm-eq">=</span>
            <span className="gsm-text">
              {desc.total} disjoint 4-cycles
              {desc.parts.map(p => (
                <span key={p.id} className="gsm-part">
                  <span className="gsm-dot" style={{ background: p.color }} />
                  {p.label} ×{p.count}
                </span>
              ))}
            </span>
          </>
        ) : (
          <span className="gsm-hint">Turn a layer: each dot slides along its circle, in step with the cube.</span>
        )}
      </div>

      <div className="graph-side-legend">
        {graph.orbits.map(o => (
          <button
            key={o.id}
            className={`gsl-item${focusOrbit === o.id ? ' active' : ''}${focusOrbit != null && focusOrbit !== o.id ? ' dim' : ''}`}
            onClick={() => onFocusOrbit(focusOrbit === o.id ? null : o.id)}
            title={`Isolate the ${o.label} orbit (${o.members.length} vertices)`}
            aria-pressed={focusOrbit === o.id}
          >
            <span className="gsl-ring" style={{ borderColor: o.color }} />
            {o.label}
            <span className="gsl-count">{o.members.length}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
