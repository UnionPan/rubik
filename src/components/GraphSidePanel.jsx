import { useMemo } from 'react';
import FaceletGraph from './FaceletGraph';

/**
 * GraphSidePanel - the facelet graph shown beside the 3D cube, with a
 * plain readout of the current move and a legend of the sticker families
 * (orbits).
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
        <button
          className={`gs-chip-btn${showOrbits ? ' active' : ''}`}
          onClick={() => onShowOrbits(!showOrbits)}
          aria-pressed={showOrbits}
          title="Ring every dot with the color of its family"
        >Families</button>
        <button className="gs-chip-btn" onClick={onExplain} title="What am I looking at?">?</button>
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
          <span className="gsm-text">
            <span className="gsm-notation">{desc.notation}</span> moved {desc.total * (desc.cycleLength ?? 4)} stickers
            around {desc.total} loop{desc.total === 1 ? '' : 's'}.
          </span>
        ) : (
          <span className="gsm-hint">Each dot is a sticker. Turn the puzzle and watch the dots slide.</span>
        )}
      </div>

      <div className="graph-side-legend">
        {graph.orbits.map(o => (
          <button
            key={o.id}
            className={`gsl-item${focusOrbit === o.id ? ' active' : ''}${focusOrbit != null && focusOrbit !== o.id ? ' dim' : ''}`}
            onClick={() => onFocusOrbit(focusOrbit === o.id ? null : o.id)}
            title={`Show only the ${o.label.toLowerCase()}`}
            aria-pressed={focusOrbit === o.id}
          >
            <span className="gsl-ring" style={{ borderColor: o.color }} />
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
