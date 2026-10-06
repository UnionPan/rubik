import { useMemo } from 'react';
import FaceletGraph from './FaceletGraph';

/**
 * GraphSidePanel - the facelet graph shown beside the 3D cube, with a
 * readout of the current move as a permutation and an orbit legend.
 * Mount with a key per puzzle.
 */
export default function GraphSidePanel({
  graph, state, highlightFace, animateRef,
  focusOrbit, onFocusOrbit, showOrbits, onShowOrbits,
  move, onMoveChange, onClose, onExplain,
}) {
  const desc = useMemo(() => (move ? graph.describeTurn(move) : null), [graph, move]);

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
          graph={graph}
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
              {desc.total} disjoint {desc.cycleLength ?? 4}-cycles
              {desc.parts.map(p => (
                <span key={p.id} className="gsm-part">
                  <span className="gsm-dot" style={{ background: p.color }} />
                  {p.label} ×{p.count}
                </span>
              ))}
            </span>
          </>
        ) : (
          <span className="gsm-hint">Turn a layer to see its cycles.</span>
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
