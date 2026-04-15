/**
 * MoveControls — face-move buttons for NxN cubes
 *
 * Props:
 *   onMove(face, layer, cw)
 *   cubeSize: N
 *   disabled: bool
 */

const FACE_META = {
  U: { bg: '#FFFFFF', fg: '#111', name: 'Up' },
  R: { bg: '#B71234', fg: '#fff', name: 'Right' },
  F: { bg: '#009B48', fg: '#fff', name: 'Front' },
  D: { bg: '#FFD500', fg: '#111', name: 'Down' },
  L: { bg: '#FF5800', fg: '#fff', name: 'Left' },
  B: { bg: '#0046AD', fg: '#fff', name: 'Back' },
};

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

// Isometric cube diagram, one visible face highlighted
function FaceDiagram({ highlight }) {
  const dim = (f) => FACE_META[f]?.bg ?? '#2a2a3e';
  const off = '#1c1c38';
  return (
    <svg width={46} height={40} viewBox="0 0 50 44" style={{ display: 'block', margin: '0 auto 5px' }}>
      {/* Top (U) */}
      <polygon points="25,2 48,13 25,24 2,13"
        fill={highlight === 'U' ? dim('U') : off} stroke="#444" strokeWidth="1.2" />
      {/* Left (L) */}
      <polygon points="2,13 25,24 25,42 2,31"
        fill={highlight === 'L' ? dim('L') : off} stroke="#444" strokeWidth="1.2" />
      {/* Right (R/F) – front-right face shown for F too */}
      <polygon points="25,24 48,13 48,31 25,42"
        fill={highlight === 'R' || highlight === 'F' ? dim(highlight) : off} stroke="#444" strokeWidth="1.2" />
    </svg>
  );
}

// Returns inner layer indices for NxN cubes.
// Only 4×4 and 5×5 have inner layers:
//   N=4 → [1]      (one slice between outer and middle)
//   N=5 → [1, 2]   (two slices; layer 2 is the center M/E/S)
//   N≤3 → []       (no inner layers on 3×3 or smaller)
function getInnerLayers(N) {
  const out = [];
  // inner layer indices run from 1 to N-3 inclusive
  for (let l = 1; l <= N - 3; l++) out.push(l);
  return out;
}

// Outer face button (large, colored bg)
function OuterBtn({ face, cw, disabled, onMove }) {
  const m = FACE_META[face];
  return (
    <button
      className={`mc-outer-btn${cw ? '' : ' prime'}${disabled ? ' disabled' : ''}`}
      style={{ background: m.bg, color: m.fg }}
      onClick={() => !disabled && onMove(face, 0, cw)}
      title={`${face}${cw ? '' : "'"} — ${m.name} face ${cw ? 'CW' : 'CCW'}`}
      disabled={disabled}
    >
      <span className="mc-lbl">{face}{cw ? '' : '′'}</span>
      <span className="mc-arrow">{cw ? '↻' : '↺'}</span>
    </button>
  );
}

// Inner-layer button — same visual style as OuterBtn, label just shows layer prefix
function InnerBtn({ face, layer, cw, disabled, onMove }) {
  const m = FACE_META[face];
  const layerNum = layer + 1; // 1-indexed layer prefix (e.g. "2R")
  const notation = `${layerNum}${face}${cw ? '' : "'"}`;
  return (
    <button
      className={`mc-outer-btn${cw ? '' : ' prime'}${disabled ? ' disabled' : ''}`}
      style={{ background: m.bg, color: m.fg }}
      onClick={() => !disabled && onMove(face, layer, cw)}
      title={`${notation} — layer ${layerNum} from ${m.name} face, ${cw ? 'CW' : 'CCW'}`}
      disabled={disabled}
    >
      <span className="mc-lbl">{layerNum}{face}{cw ? '' : '′'}</span>
      <span className="mc-arrow">{cw ? '↻' : '↺'}</span>
    </button>
  );
}

export default function MoveControls({ onMove, cubeSize = 3, disabled = false }) {
  const inners = getInnerLayers(cubeSize);

  return (
    <div className="move-controls">

      {/* ── Header ── */}
      <div className="mc-header">
        <span className="mc-title">Face Moves</span>
        <span className="mc-hint">CW &amp; CCW per face</span>
      </div>

      {/* ── Outer layer: 3×2 grid with face diagrams ── */}
      <div className="mc-outer-grid">
        {FACES.map(face => (
          <div key={face} className="mc-face-cell">
            <FaceDiagram highlight={face} />
            <div className="mc-btn-pair">
              <OuterBtn face={face} cw={true}  disabled={disabled} onMove={onMove} />
              <OuterBtn face={face} cw={false} disabled={disabled} onMove={onMove} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Inner layers (4×4 / 5×5 only) ── */}
      {inners.length > 0 && (
        <div className="mc-inner-section">
          <div className="mc-inner-header">
            <span className="mc-inner-title">Inner Layers</span>
            <span className="mc-inner-hint">
              {cubeSize === 4 && 'Layer 2 slices (inside the outer face)'}
              {cubeSize === 5 && 'Layers 2 & 3 — layer 3 is the center slice'}
            </span>
          </div>

          {inners.map(layer => (
            <div key={layer} className="mc-inner-row">
              <div className="mc-inner-row-label">
                <span className="mc-layer-badge">L{layer + 1}</span>
              </div>
              <div className="mc-inner-btn-grid">
                {FACES.map(face => (
                  <div key={face} className="mc-inner-pair">
                    <InnerBtn face={face} layer={layer} cw={true}  disabled={disabled} onMove={onMove} />
                    <InnerBtn face={face} layer={layer} cw={false} disabled={disabled} onMove={onMove} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mc-inner-note">
            <code>2R</code> = 2nd slice from the Right face · <code>3R</code> on 5×5 = center M-slice
          </div>
        </div>
      )}

      {/* ── Face legend ── */}
      <div className="mc-legend">
        {FACES.map(face => {
          const m = FACE_META[face];
          return (
            <div key={face} className="mc-legend-item">
              <div className="mc-legend-chip" style={{ background: m.bg, color: m.fg }}>{face}</div>
              <span className="mc-legend-name">{m.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
