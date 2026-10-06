/**
 * Facelet graph - the Schreier graph of the cube group acting on facelets.
 *
 * Vertices: the 6·N² facelet positions (same indexing as cubeState:
 *   face*N*N + row*N + col).
 * Edges:    for every generator g (a face or slice quarter turn), an edge
 *           x → g(x) for each facelet x that g moves.
 *
 * Geometry: each facelet is placed on the unit sphere so that every layer
 * turn is an exact rigid rotation of the sphere.  A facelet on the +z face
 * whose cubie has coordinates (i, j) along x and y sits at
 *   (g(i), g(j), +√(1 − g(i)² − g(j)²))
 * where g is an odd, evenly spaced "latitude" function.  A quarter turn of a
 * layer then permutes this point set exactly, and every facelet travels along
 * a circle of latitude around the move axis.  Projecting the sphere from the
 * hidden corner (an azimuthal projection, see `project`) turns those circles
 * into three families of nested loops, one family per axis.
 */
import { FACE, FACE_NAMES, getMovePositionCycles, applyTurn } from './cubeState';

// Axis index (0=x, 1=y, 2=z) and outward sign for each face
const FACE_AXIS = {
  R: [0, 1], L: [0, -1],
  U: [1, 1], D: [1, -1],
  F: [2, 1], B: [2, -1],
};

// Rotation for a clockwise quarter turn of each face, matching CubeViewer3D.
const MOVE_ROT = {
  U: { axis: 1, sign: -1 }, D: { axis: 1, sign: 1 },
  R: { axis: 0, sign: -1 }, L: { axis: 0, sign: 1 },
  F: { axis: 2, sign: -1 }, B: { axis: 2, sign: 1 },
};

/** Cubie coordinates (0..N-1 on each axis) of facelet (f, r, c), per cubeState conventions */
export function faceletCubie(f, r, c, N) {
  const M = N - 1;
  switch (FACE_NAMES[f]) {
    case 'U': return [c, M, r];
    case 'D': return [c, 0, M - r];
    case 'R': return [M, M - r, M - c];
    case 'L': return [0, M - r, c];
    case 'F': return [c, M - r, M];
    case 'B': return [M - c, M - r, 0];
    default:  return null;
  }
}

/**
 * Largest latitude β used for the outermost layer.  Chosen so the gap between
 * corner facelets of neighbouring faces is ~GAP_RATIO × the in-face spacing.
 */
const GAP_RATIO = 1.25;
function outerLatitude(N) {
  if (N === 1) return 0;
  const k = 1 + (2 * GAP_RATIO) / (N - 1);
  return 1 / Math.sqrt(2 + k * k);
}

/** Latitude of layer index i (0..N-1) along an axis */
function latitude(i, N, beta) {
  if (N === 1) return 0;
  return beta * (2 * i - (N - 1)) / (N - 1);
}

/** Sphere point of a facelet */
function spherePoint(f, r, c, N, beta) {
  const cubie = faceletCubie(f, r, c, N);
  const [axis, sign] = FACE_AXIS[FACE_NAMES[f]];
  const p = [0, 0, 0];
  let sq = 0;
  for (let a = 0; a < 3; a++) {
    if (a === axis) continue;
    p[a] = latitude(cubie[a], N, beta);
    sq += p[a] * p[a];
  }
  p[axis] = sign * Math.sqrt(1 - sq);
  return p;
}

/** Rotate point p about coordinate axis by angle (right-hand rule) */
export function rotateAboutAxis(p, axis, angle) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  const [x, y, z] = p;
  if (axis === 0) return [x, y * cs - z * sn, y * sn + z * cs];
  if (axis === 1) return [x * cs + z * sn, y, -x * sn + z * cs];
  return [x * cs - y * sn, x * sn + y * cs, z];
}

/** Full rotation angle of a quarter turn (radians, signed) */
export function moveAngle(face, cw) {
  return (Math.PI / 2) * MOVE_ROT[face].sign * (cw ? 1 : -1);
}
export function moveAxis(face) { return MOVE_ROT[face].axis; }

/** Does facelet with cubie coords lie in the slice (face, layer)? */
export function inSlice(cubie, face, layer, N) {
  const [x, y, z] = cubie;
  switch (face) {
    case 'U': return y === N - 1 - layer;
    case 'D': return y === layer;
    case 'R': return x === N - 1 - layer;
    case 'L': return x === layer;
    case 'F': return z === N - 1 - layer;
    case 'B': return z === layer;
    default:  return false;
  }
}

// ── Projection ────────────────────────────────────────────────────────────
// Viewed from the URF corner (like the default 3D camera): the three visible
// faces U, F, R form a curved hexagon in the middle and the three hidden
// faces wrap around it.  The projection pole is the hidden DLB corner.
/**
 * Radial profile of the projection as a function of angular distance θ from
 * the view centre.  Pure stereographic projection (tan θ/2) maps circles to
 * circles but sends the far corner to infinity and crushes the visible
 * faces.  The azimuthal equidistant profile (θ/π) keeps the whole sphere in
 * the unit disc with even spacing; latitude circles become smooth ovals that
 * still form one coaxial family per axis.
 */
function radialProfile(theta) {
  return theta / Math.PI;
}

/**
 * Azimuthal projection of the unit sphere seen from direction `view`, with
 * +y pointing up on screen.  Returns p ↦ [x, y] in the unit disc (y down,
 * for SVG).  The antipode of `view` is singular, so choose a view with no
 * sticker exactly opposite it.
 */
export function makeProjection(view) {
  const V = normalize(view);
  const E_UP = normalize(sub([0, 1, 0], scale(V, dot([0, 1, 0], V))));
  const E_RIGHT = cross(E_UP, V);
  return (p) => {
    const c = Math.max(-1, Math.min(1, dot(p, V)));
    const theta = Math.acos(c);
    const px = dot(p, E_RIGHT), py = dot(p, E_UP);
    const len = Math.hypot(px, py);
    if (len < 1e-9) return [0, 0];
    const R = radialProfile(theta);
    return [(px / len) * R, -(py / len) * R];
  };
}

/** The cube's projection: seen from the URF corner, with the DLB corner as the pole */
export const project = makeProjection([1, 1, 1]);

// ── Orbits (connected components of the Schreier graph) ────────────────────

/**
 * Generators: all outer face turns and inner slice turns, except the central
 * slice of odd cubes (which only re-orients the cube and would move centers).
 */
export function generatorMoves(N) {
  const moves = [];
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
    for (let layer = 0; layer < Math.floor(N / 2); layer++) {
      moves.push({ face, layer });
    }
  }
  return moves;
}

function findOrbits(N) {
  const total = 6 * N * N;
  const parent = Array.from({ length: total }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const { face, layer } of generatorMoves(N)) {
    for (const cyc of getMovePositionCycles(face, layer, true, N)) {
      for (let k = 1; k < cyc.length; k++) {
        parent[find(cyc[k])] = find(cyc[0]);
      }
    }
  }
  const groups = new Map();
  for (let i = 0; i < total; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }
  return [...groups.values()];
}

/**
 * Classify an orbit by its cubie type.
 * On-boundary count: 3 → corner, 2 → edge, 1 → center.
 */
function classifyOrbit(members, nodes, N) {
  const n0 = nodes[members[0]];
  const bnd = n0.cubie.filter(v => v === 0 || v === N - 1).length;
  if (members.length === 1) return { kind: 'fixed', label: 'Fixed center' };
  if (bnd === 3) return { kind: 'corner', label: 'Corners' };

  // Distance from the middle along the non-normal axes, used to name the type
  const [axis] = FACE_AXIS[FACE_NAMES[n0.f]];
  const offs = n0.cubie
    .filter((_, a) => a !== axis)
    .map(v => Math.abs(2 * v - (N - 1)));
  if (bnd === 2) {
    const inner = Math.min(...offs);
    if (inner === 0) return { kind: 'edge', label: N === 3 ? 'Edges' : 'Midges' };
    return { kind: 'wing', label: 'Wings' };
  }
  const [a, b] = offs;
  if (a === b) return { kind: 'xcenter', label: N === 4 ? 'Centers' : 'X-centers' };
  if (a === 0 || b === 0) return { kind: 'tcenter', label: '+-centers' };
  return { kind: 'oblique', label: 'Obliques' };
}

// Orbit palette - distinct hues that do not clash with the six sticker colors
const ORBIT_COLORS = ['#a78bfa', '#38bdf8', '#f472b6', '#a3e635', '#2dd4bf', '#f0abfc', '#fde68a', '#94a3b8'];

// ── Public: build the graph ──────────────────────────────────────────────────

const cache = new Map();

/**
 * Build (and cache) the facelet graph for an N×N cube.
 * Returns { N, beta, nodes, orbits, circles, radius, spacing, faceLabels }.
 *   nodes[i]  = { i, f, r, c, cubie, sphere, xy, orbit }
 *   orbits[k] = { id, kind, label, members, color }
 *   circles   = [{ key, axis, lat, type: 'belt'|'cap', members, d, extent }]
 */
export function buildFaceletGraph(N) {
  if (cache.has(N)) return cache.get(N);
  const beta = outerLatitude(N);
  const nodes = [];
  for (let f = 0; f < 6; f++) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cubie = faceletCubie(f, r, c, N);
        const sphere = spherePoint(f, r, c, N, beta);
        nodes.push({ i: nodes.length, f, r, c, cubie, sphere, xy: project(sphere), orbit: -1 });
      }
    }
  }

  const rawOrbits = findOrbits(N).map(members => ({
    members, ...classifyOrbit(members, nodes, N),
  }));
  // Stable order: corners, edges/midges, wings, centers, fixed
  const kindRank = { corner: 0, edge: 1, wing: 2, xcenter: 3, tcenter: 4, oblique: 5, fixed: 6 };
  rawOrbits.sort((a, b) => (kindRank[a.kind] - kindRank[b.kind]) || (a.members[0] - b.members[0]));

  const orbits = [];
  const fixed = [];
  rawOrbits.forEach(o => {
    if (o.kind === 'fixed') { fixed.push(...o.members); return; }
    orbits.push(o);
  });
  // Number repeated labels (Wings A / Wings B …)
  const labelCount = {};
  orbits.forEach(o => { labelCount[o.label] = (labelCount[o.label] || 0) + 1; });
  const labelSeen = {};
  orbits.forEach((o, id) => {
    o.id = id;
    o.color = ORBIT_COLORS[id % ORBIT_COLORS.length];
    if (labelCount[o.label] > 1) {
      labelSeen[o.label] = (labelSeen[o.label] || 0) + 1;
      o.label = `${o.label} ${String.fromCharCode(64 + labelSeen[o.label])}`;
    }
    o.members.forEach(i => { nodes[i].orbit = id; });
  });
  if (fixed.length) {
    const id = orbits.length;
    // Fixed by every generator (face and inner-slice turns); M/E/S and rotations do move them
    orbits.push({ id, kind: 'fixed', label: 'Face centers', members: fixed, color: '#78716c' });
    fixed.forEach(i => { nodes[i].orbit = id; });
  }

  const circles = buildCircles(N, beta, nodes);

  // Bounding radius of projected layout (for SVG viewBox)
  let radius = 0;
  nodes.forEach(n => { radius = Math.max(radius, Math.hypot(n.xy[0], n.xy[1])); });
  circles.forEach(c => { radius = Math.max(radius, c.extent); });

  // Smallest distance between two projected facelets - sets the dot size
  let spacing = Infinity;
  for (let a = 0; a < nodes.length; a++) {
    for (let b = a + 1; b < nodes.length; b++) {
      const d = Math.hypot(nodes[a].xy[0] - nodes[b].xy[0], nodes[a].xy[1] - nodes[b].xy[1]);
      if (d < spacing) spacing = d;
    }
  }

  // Face labels sit at each face's pole on the sphere
  const faceLabels = FACE_NAMES.map(name => {
    const [axis, sign] = FACE_AXIS[name];
    const p = [0, 0, 0];
    p[axis] = sign;
    return { name, xy: project(p) };
  });

  const graph = { N, beta, nodes, orbits, circles, radius, spacing, faceLabels };
  cache.set(N, graph);
  return graph;
}

/**
 * Every facelet moves on a circle of latitude around the axis of the move.
 * Collect the distinct latitudes per axis and which slice turns use them:
 *   'belt' circles carry the side facelets of one layer,
 *   'cap' circles carry facelets of an outer face spinning in place.
 */
function buildCircles(N, beta, nodes) {
  const circles = [];
  const seen = new Map();
  const SAMPLES = 360;

  for (let axis = 0; axis < 3; axis++) {
    const [a1, a2] = [0, 1, 2].filter(a => a !== axis);
    for (const n of nodes) {
      const lat = n.sphere[axis];
      const key = `${axis}:${lat.toFixed(5)}`;
      if (!seen.has(key)) {
        const normalAxis = FACE_AXIS[FACE_NAMES[n.f]][0];
        const rho = Math.sqrt(Math.max(0, 1 - lat * lat));
        const pts = [];
        let extent = 0;
        for (let s = 0; s <= SAMPLES; s++) {
          const t = (s / SAMPLES) * Math.PI * 2;
          const p = [0, 0, 0];
          p[axis] = lat; p[a1] = rho * Math.cos(t); p[a2] = rho * Math.sin(t);
          const xy = project(p);
          extent = Math.max(extent, Math.hypot(xy[0], xy[1]));
          pts.push(xy);
        }
        const d = 'M' + pts.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join('L') + 'Z';
        const circle = {
          key, axis, lat, d, extent, members: [],
          type: normalAxis === axis ? 'cap' : 'belt',
        };
        seen.set(key, circle);
        circles.push(circle);
      }
      seen.get(key).members.push(n.i);
    }
  }
  // Drop degenerate circles (a lone face center sitting on its own axis)
  return circles.filter(c => c.members.length > 1);
}

/** Circles swept by a turn of the given layers */
export function circlesForMove(graph, face, layers) {
  const { N, circles, nodes } = graph;
  const axis = MOVE_ROT[face].axis;
  return circles.filter(c => c.axis === axis &&
    c.members.some(i => layers.some(layer => inSlice(nodes[i].cubie, face, layer, N))));
}

/** Indices of facelets moved (or spun in place) by a turn of the given layers */
export function nodesInSlice(graph, face, layers) {
  const { N, nodes } = graph;
  return nodes.filter(n => layers.some(layer => inSlice(n.cubie, face, layer, N))).map(n => n.i);
}

/** Position of facelet i part-way through a turn (fraction t of the full angle) */
export function nodePositionDuring(graph, i, face, cw, t) {
  const p = rotateAboutAxis(graph.nodes[i].sphere, MOVE_ROT[face].axis, moveAngle(face, cw) * t);
  return project(p);
}

// ── Group-theoretic readouts ────────────────────────────────────────────────

/** A turn ({ face, layers, cw, notation }) as a permutation of the graph: its 4-cycles by orbit */
export function describeMove(graph, move) {
  if (!move) return null;
  const counts = {};
  for (const layer of move.layers) {
    const c = moveCyclesByOrbit(graph, move.face, layer);
    for (const k in c) counts[k] = (counts[k] || 0) + c[k];
  }
  const parts = graph.orbits
    .filter(o => counts[o.id])
    .map(o => ({ id: o.id, label: o.label, color: o.color, count: counts[o.id] }));
  const total = parts.reduce((s, p) => s + p.count, 0);
  return { notation: move.notation, total, parts };
}

/** Orbit id → number of 4-cycles a quarter turn makes inside that orbit */
export function moveCyclesByOrbit(graph, face, layer) {
  const counts = {};
  for (const cyc of getMovePositionCycles(face, layer, true, graph.N)) {
    const o = graph.nodes[cyc[0]].orbit;
    counts[o] = (counts[o] || 0) + 1;
  }
  return counts;
}

/**
 * Sign character of each generator on each orbit.  A quarter turn is a
 * product of 4-cycles (each odd), so its sign on an orbit is (−1)^(#4-cycles).
 * Because sign is a homomorphism, the parity of any element on an orbit is
 * the product of these signs over the moves that make it up.
 * Returns [{ face, layer, signs: { orbitId: ±1 } }]
 */
export function generatorSigns(graph) {
  return generatorMoves(graph.N).map(({ face, layer }) => {
    const counts = moveCyclesByOrbit(graph, face, layer);
    const signs = {};
    graph.orbits.forEach(o => {
      signs[o.id] = (counts[o.id] || 0) % 2 === 0 ? 1 : -1;
    });
    return { face, layer, signs };
  });
}

/** Per orbit: how many vertices carry the color of their home face */
export function orbitColorMatch(graph, state) {
  const { N } = graph;
  return graph.orbits.map(o => {
    let ok = 0;
    for (const i of o.members) {
      const n = graph.nodes[i];
      if (state[n.f][n.r][n.c] === n.f) ok++;
    }
    return { id: o.id, ok, total: o.members.length, N };
  });
}

/**
 * Restrict a facelet permutation (perm[i] = where the sticker now at i came
 * from) to each orbit: cycle type and parity.
 */
export function permByOrbit(graph, perm) {
  const visited = new Uint8Array(perm.length);
  const out = graph.orbits.map(o => ({ id: o.id, cycles: [], moved: 0 }));
  for (let s = 0; s < perm.length; s++) {
    if (visited[s]) continue;
    const cyc = [];
    let cur = s;
    while (!visited[cur]) { visited[cur] = 1; cyc.push(cur); cur = perm[cur]; }
    if (cyc.length > 1) {
      const entry = out[graph.nodes[s].orbit];
      entry.cycles.push(cyc.length);
      entry.moved += cyc.length;
    }
  }
  out.forEach(e => {
    e.parity = e.cycles.reduce((acc, len) => acc + len - 1, 0) % 2 === 0 ? 'even' : 'odd';
  });
  return out;
}

/**
 * Diameter of each connected component of the Schreier graph, measured in
 * quarter turns (each generator and its inverse count as one step).
 */
const diameterCache = new Map();
export function orbitDiameters(graph) {
  if (diameterCache.has(graph.N)) return diameterCache.get(graph.N);
  const total = graph.nodes.length;
  const adj = Array.from({ length: total }, () => new Set());
  for (const { face, layer } of generatorMoves(graph.N)) {
    for (const cyc of getMovePositionCycles(face, layer, true, graph.N)) {
      for (let k = 0; k < cyc.length; k++) {
        adj[cyc[k]].add(cyc[(k + 1) % cyc.length]);
        adj[cyc[(k + 1) % cyc.length]].add(cyc[k]);
      }
    }
  }
  const result = graph.orbits.map(o => {
    let diameter = 0;
    for (const src of o.members) {
      const dist = new Map([[src, 0]]);
      const queue = [src];
      while (queue.length) {
        const v = queue.shift();
        for (const w of adj[v]) {
          if (!dist.has(w)) { dist.set(w, dist.get(v) + 1); queue.push(w); }
        }
      }
      for (const d of dist.values()) diameter = Math.max(diameter, d);
    }
    return { id: o.id, diameter };
  });
  diameterCache.set(graph.N, result);
  return result;
}

/**
 * Check that every component of the Schreier graph is exactly one orbit of
 * the rotation group O of the whole cube (generated by x and y rotations,
 * i.e. turning all layers at once).  O has order 24 and acts freely on
 * non-center facelets, which is why every component has 24 vertices.
 */
export function componentsAreRotationOrbits(graph) {
  const { N, nodes, orbits } = graph;
  const wholeCube = (face) => {
    const p = nodes.map(n => n.i);
    for (let layer = 0; layer < N; layer++) {
      for (const cyc of getMovePositionCycles(face, layer, true, N)) {
        for (let k = 0; k < cyc.length; k++) p[cyc[k]] = cyc[(k + 1) % cyc.length];
      }
    }
    return p;
  };
  const X = wholeCube('R'), Y = wholeCube('U');
  return orbits.every(o => {
    const seen = new Set([o.members[0]]);
    const stack = [o.members[0]];
    while (stack.length) {
      const v = stack.pop();
      for (const w of [X[v], Y[v]]) if (!seen.has(w)) { seen.add(w); stack.push(w); }
    }
    return seen.size === o.members.length && o.members.every(m => seen.has(m));
  });
}

// ── Small vector helpers ──────────────────────────────────────────────────────
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function normalize(a) { const l = Math.hypot(...a); return scale(a, 1 / l); }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export { FACE };

// ── Graph model: the interface FaceletGraph draws from ───────────────────────
// The generic puzzle engine (lib/puzzles/engine.js) provides the same shape.

const CUBE_COLORS = ['#FFFFFF', '#B71234', '#009B48', '#FFD500', '#FF5800', '#0046AD'];
const modelCache = new Map();

/** Facelet-graph model of the N×N cube */
export function cubeGraphModel(N) {
  if (modelCache.has(N)) return modelCache.get(N);
  const g = buildFaceletGraph(N);
  const model = {
    ...g,
    kind: 'cube',
    colors: CUBE_COLORS,
    labelsOnDots: N % 2 === 1,
    nodes: g.nodes.map(n => ({ ...n, face: n.f })),
    colorOf: (state, i) => { const n = g.nodes[i]; return state[n.f][n.r][n.c]; },
    movingNodes: (t) => nodesInSlice(g, t.face, t.layers),
    circleKeysFor: (t) => new Set(circlesForMove(g, t.face, t.layers).map(c => c.key)),
    positionDuring: (i, t, frac) => nodePositionDuring(g, i, t.face, t.cw, frac),
    applyTurn,
    labelOf: (i) => { const n = g.nodes[i]; return `${FACE_NAMES[n.f]}[${n.r}][${n.c}]`; },
    describeTurn: (t) => describeMove(g, t),
  };
  modelCache.set(N, model);
  return model;
}
