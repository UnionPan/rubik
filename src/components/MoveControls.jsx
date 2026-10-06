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

// Mini cube net (U on top; L F R B across; D below) with one face highlighted.
// Unlike an isometric view, every face, including D, L and B, is visible.
const NET_CELLS = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
function FaceDiagram({ highlight }) {
  const cell = 10, gap = 1.5;
  return (
    <svg width={4 * (cell + gap)} height={3 * (cell + gap)} viewBox={`0 0 ${4 * (cell + gap)} ${3 * (cell + gap)}`}
      style={{ display: 'block', margin: '0 auto 5px' }} aria-hidden="true">
      {Object.entries(NET_CELLS).map(([face, [col, row]]) => (
        <rect key={face}
          x={col * (cell + gap)} y={row * (cell + gap)} width={cell} height={cell} rx={1.5}
          fill={face === highlight ? FACE_META[face].bg : '#1c1c38'}
          stroke={face === highlight ? '#0c0b09' : '#3a3420'} strokeWidth="0.8" />
      ))}
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
            <span className="mc-inner-title">Inner layers</span>
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

        </div>
      )}

    </div>
  );
}
