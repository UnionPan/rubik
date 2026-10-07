/**
 * StageIcon - a small cube seen from above (top, front, right), colored where
 * a solving stage leaves the cube solved and gray elsewhere.  The first layer
 * is the bottom one, as in the detector.
 */

const FACE_COLOR = { U: '#F5F0E8', F: '#009B48', R: '#B71234' };
const GRAY = '#3a3420';

const mid = (n, i) => n === 3 && i === 1;
const bottom = (n, r) => r === n - 1;

// stage → (face, row, col, n) → solved?
const MASKS = {
  centers: (f, r, c, n) => mid(n, r) && mid(n, c),
  edges: (f, r, c, n) => mid(n, r) || mid(n, c),
  cross: (f, r, c, n) => (f === 'U' ? mid(n, r) && mid(n, c) : (mid(n, r) && mid(n, c)) || (bottom(n, r) && mid(n, c))),
  'first-layer': (f, r, c, n) => f !== 'U' && bottom(n, r),
  f2l: (f, r, c, n) => (f === 'U' ? mid(n, r) && mid(n, c) : r > 0),
  oll: (f, r) => f === 'U' || r > 0,
  'oll-parity': (f, r) => f === 'U' || r > 0,
  pll: () => true,
  'pll-parity': () => true,
  solved: () => true,
};

// Isometric projection of the cube [0, n]³: x to the lower right, y to the lower left, z up
const P = (x, y, z) => [0.866 * (x - y), 0.5 * (x + y) - z];

function sticker(face, r, c, n) {
  const k = 0.08; // inset
  const a = k, b = 1 - k;
  const corners = [[a, a], [b, a], [b, b], [a, b]];
  return corners.map(([u, v]) => {
    if (face === 'U') return P(c + u, r + v, n);
    if (face === 'F') return P(c + u, n, n - r - v);
    return P(n, n - c - u, n - r - v); // R
  });
}

export default function StageIcon({ stage, n = 3, size = 34 }) {
  const mask = MASKS[stage];
  if (!mask) return null;
  const polys = [];
  for (const face of ['U', 'F', 'R']) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const pts = sticker(face, r, c, n);
        polys.push(
          <polygon key={`${face}${r}${c}`} points={pts.map(p => p.map(v => v.toFixed(3)).join(',')).join(' ')}
            fill={mask(face, r, c, n) ? FACE_COLOR[face] : GRAY} />,
        );
      }
    }
  }
  const w = 0.866 * n;
  return (
    <svg className="stage-icon" width={size} height={size} viewBox={`${-w - 0.15} ${-n - 0.15} ${2 * w + 0.3} ${2 * n + 0.3}`} aria-hidden="true">
      <polygon points={[P(0, 0, n), P(n, 0, n), P(n, 0, 0), P(n, n, 0), P(0, n, 0), P(0, n, n)].map(p => p.join(',')).join(' ')}
        fill="#0c0b09" />
      {polys}
    </svg>
  );
}
