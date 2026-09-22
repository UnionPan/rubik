import { FACE } from '../lib/cubeState';

// Official WCA face colors
const FACE_COLOR_MAP = ['#FFFFFF', '#B71234', '#009B48', '#FFD500', '#FF5800', '#0046AD'];

// ── FlatCubeMap ────────────────────────────────────────────────────────────
// Scales to its container through the viewBox; face labels sit in the gutters.
export default function FlatCubeMap({ state, size = 3, highlightFace = null }) {
  const N = size;
  const cell = 10;
  const gap = 1.2;
  const faceW = N * cell + (N - 1) * gap;
  const gutter = 7;          // space between faces, holds the labels
  const labelH = 7;          // room above the top row for the U label
  const pitch = faceW + gutter;

  const faceLayout = [
    { face: 'U', col: 1, row: 0 },
    { face: 'L', col: 0, row: 1 },
    { face: 'F', col: 1, row: 1 },
    { face: 'R', col: 2, row: 1 },
    { face: 'B', col: 3, row: 1 },
    { face: 'D', col: 1, row: 2 },
  ];

  const totalW = 4 * pitch - gutter;
  const totalH = labelH + 3 * pitch - gutter;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      style={{ display: 'block', width: '100%', height: '100%', maxWidth: 520 }}
      role="img"
      aria-label="Unfolded net of the cube"
    >
      {faceLayout.map(({ face, col, row }) => {
        const fi   = FACE[face];
        const ox   = col * pitch;
        const oy   = labelH + row * pitch;
        const isHL = highlightFace === face;
        return (
          <g key={face}>
            <text x={ox + faceW / 2} y={oy - 2} textAnchor="middle" fontSize={4.6}
              fill={isHL ? '#FF8C42' : '#7a7060'} fontFamily="JetBrains Mono, monospace" fontWeight="bold"
            >{face}</text>
            {state[fi].map((rowArr, r) =>
              rowArr.map((color, c) => (
                <rect
                  key={`${r}-${c}`}
                  x={ox + c * (cell + gap)}
                  y={oy + r * (cell + gap)}
                  width={cell} height={cell}
                  fill={FACE_COLOR_MAP[color]}
                  stroke={isHL ? '#FF8C42' : '#0c0b09'}
                  strokeWidth={isHL ? 0.8 : 0.4}
                  rx={1.2}
                />
              ))
            )}
          </g>
        );
      })}
    </svg>
  );
}
