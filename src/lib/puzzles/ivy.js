/**
 * Ivy Cube ("maple leaf" cube).
 *
 * A cube of side 2 centered at the origin, turning about four alternate
 * corners: URF, ULB, DLF, DRB.  A turn rotates everything within distance 2
 * (one edge length) of its corner by 120°: that corner piece and the three
 * leaf-shaped centers next to it.  On each face this sphere cuts a quarter
 * circle around each of the face's two turning corners; the two quarter discs
 * overlap in the leaf.
 *
 * Positions: corners only twist (3⁴), centers make even permutations (6!/2):
 * 81 · 360 = 29,160.
 */
import { add, scale, arc, normalize } from './geometry';

const ARC_STEPS = 18;

// Faces in cube order U R F D L B: outward normal and two in-plane axes
const FACES = [
  { name: 'U', n: [0, 1, 0] }, { name: 'R', n: [1, 0, 0] }, { name: 'F', n: [0, 0, 1] },
  { name: 'D', n: [0, -1, 0] }, { name: 'L', n: [-1, 0, 0] }, { name: 'B', n: [0, 0, -1] },
];

// The four turning corners (a tetrahedral set) and their move letters
export const IVY_AXES = [
  { name: 'F', corner: 'URF', point: [1, 1, 1] },
  { name: 'U', corner: 'ULB', point: [-1, 1, -1] },
  { name: 'L', corner: 'DLF', point: [-1, -1, 1] },
  { name: 'R', corner: 'DRB', point: [1, -1, -1] },
];
const isTurningCorner = (p) => p[0] * p[1] * p[2] > 0;

function faceCorners(n) {
  const out = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const p = n.map(v => (v !== 0 ? v : null));
    let k = 0;
    out.push(p.map(v => (v !== null ? v : (k++ === 0 ? a : b))));
  }
  return out;
}

function buildStickers() {
  const stickers = [];
  FACES.forEach((face, f) => {
    const corners = faceCorners(face.n);
    const turning = corners.filter(isTurningCorner);   // a1, a2 (diagonally opposite)
    const other = corners.filter(c => !isTurningCorner(c)); // c1, c2
    const [a1, a2] = turning, [c1, c2] = other;
    const faceCenter = face.n;

    // Leaf: inside both quarter discs.  Its edges are the arc around a1 (near
    // a2) and the arc around a2 (near a1), both from c1 to c2.
    const leaf = [...arc(a1, c1, c2, ARC_STEPS), ...arc(a2, c2, c1, ARC_STEPS).slice(1, -1)];
    stickers.push({
      face: f, kind: 'leaf', piece: `leaf-${face.name}`,
      outline: leaf, anchor: faceCenter, center: faceCenter, normal: face.n,
    });

    // Corner regions: from c1 to the corner, to c2, back along the other disc's arc
    for (const [a, b] of [[a1, a2], [a2, a1]]) {
      const outline = [c1, a, c2, ...arc(b, c2, c1, ARC_STEPS).slice(1, -1)];
      const corner = IVY_AXES.find(x => x.point.every((v, i) => v === a[i])).corner;
      stickers.push({
        face: f, kind: 'corner', piece: `corner-${corner}`,
        outline, anchor: a,
        // rotation-equivariant reference point: part way from the corner to the face center
        center: add(a, scale(add(faceCenter, scale(a, -1)), 0.5)),
        normal: face.n,
      });
    }
  });
  return stickers;
}

export const ivy = {
  id: 'ivy',
  name: 'Ivy Cube',
  shortName: 'Ivy',
  body: 'cube',
  faceNames: FACES.map(f => f.name),
  colors: ['#FFFFFF', '#B71234', '#009B48', '#FFD500', '#FF5800', '#0046AD'],
  stickers: buildStickers(),
  axes: IVY_AXES.map(a => ({ name: a.name, label: a.corner, vector: normalize(a.point), point: a.point })),
  turnAngle: (2 * Math.PI) / 3,
  /** A turn of `axis` moves the stickers within one edge length (2) of its corner */
  turns: (axis, sticker) => Math.hypot(...sticker.center.map((v, i) => v - axis.point[i])) < 2,
  kinds: { corner: 'Corners', leaf: 'Leaves' },
  expectedOrder: 29160,
  displayScale: 1.5,
  // Graph drawn from the 3D view's default camera direction (no sticker sits
  // exactly opposite it, where the projection is singular)
  view: [0.5097, 0.4794, 0.7139],
};
