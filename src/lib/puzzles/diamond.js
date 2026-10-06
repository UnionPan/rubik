/**
 * Skewb Diamond: an octahedron with the Skewb's deep-cut mechanism.
 *
 * Vertices at ±x, ±y, ±z (the 6 corner pieces, 4 stickers each); each of the
 * 8 triangular faces splits into a center triangle and 3 corner triangles.
 * Four faces - URF, ULB, DLF, DRB, one per turning axis - stay fixed; a turn
 * rotates the half of the puzzle on that face's side by 120°: the fixed face
 * spins in place, 3 corners and the 3 neighbouring (free) centers cycle.
 *
 * Positions: 6!·4!·2⁶ / 8 = 138,240 (corners make even permutations, free
 * centers even permutations, and an even number of corners are flipped).
 */
import { add, scale, lerp, normalize, dot } from './geometry';

const VERTICES = {
  U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
};

// Faces as octants, named by their three vertices
const FACES = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];
const faceName = (vs) => vs.join('');

// Turning axes = normals of the four fixed faces (a tetrahedral set)
export const DIAMOND_AXES = [
  { name: 'F', face: 'URF' },
  { name: 'U', face: 'ULB' },
  { name: 'L', face: 'DLF' },
  { name: 'R', face: 'DRB' },
];

function buildStickers() {
  const stickers = [];
  FACES.forEach((vs, f) => {
    const [p, q, r] = vs.map(v => VERTICES[v]);
    const normal = normalize(add(add(p, q), r));
    const mid = (a, b) => lerp(a, b, 0.5);
    const mpq = mid(p, q), mqr = mid(q, r), mrp = mid(r, p);
    const centroid = (pts) => scale(pts.reduce((s, x) => add(s, x), [0, 0, 0]), 1 / pts.length);
    const fixed = DIAMOND_AXES.some(a => [...a.face].sort().join('') === [...vs].sort().join(''));

    stickers.push({
      face: f, kind: fixed ? 'fixed' : 'free', piece: `center-${faceName(vs)}`,
      outline: [mpq, mqr, mrp], anchor: centroid([mpq, mqr, mrp]),
      center: centroid([mpq, mqr, mrp]), normal,
    });
    for (const [v, a, b, name] of [[p, mpq, mrp, vs[0]], [q, mqr, mpq, vs[1]], [r, mrp, mqr, vs[2]]]) {
      const outline = [v, a, b];
      stickers.push({
        face: f, kind: 'corner', piece: `corner-${name}`,
        outline, anchor: centroid(outline), center: centroid(outline), normal,
      });
    }
  });
  return stickers;
}

const FACE_NORMALS = Object.fromEntries(FACES.map(vs => [
  [...vs].sort().join(''), normalize(vs.map(v => VERTICES[v]).reduce(add, [0, 0, 0])),
]));

export const diamond = {
  id: 'diamond',
  name: 'Skewb Diamond',
  shortName: 'Diamond',
  body: 'octahedron',
  faceNames: FACES.map(faceName),
  colors: ['#FFFFFF', '#B71234', '#009B48', '#FF5800', '#FFD500', '#0046AD', '#7C3AED', '#F472B6'],
  stickers: buildStickers(),
  axes: DIAMOND_AXES.map(a => ({
    name: a.name, label: a.face, vector: FACE_NORMALS[[...a.face].sort().join('')],
  })),
  turnAngle: (2 * Math.PI) / 3,
  /** A turn rotates the half of the puzzle on the fixed face's side */
  turns: (axis, sticker) => dot(sticker.center, axis.vector) > 1e-9,
  kinds: { corner: 'Corners', free: 'Free centers', fixed: 'Fixed centers' },
  expectedOrder: 138240,
  displayScale: 2.2,
  // Axis letters sit on the fixed faces, whose center sticker is exactly there
  labelsOnDots: true,
  // Graph drawn from the 3D view's default camera direction (no sticker sits
  // exactly opposite it, where the projection is singular)
  view: [0.5097, 0.4794, 0.7139],
};
