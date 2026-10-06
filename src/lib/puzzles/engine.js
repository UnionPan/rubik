/**
 * Generic puzzle engine.  A puzzle is described by geometry only:
 *   stickers  outline polygons with a home color and a rotation-equivariant
 *             reference point (`center`)
 *   axes      turning axes through the origin
 *   turns     which stickers a turn about an axis carries along
 * Everything else is derived here: each move's permutation of the stickers
 * (by rotating reference points and matching them), notation, the full
 * Cayley graph by breadth-first search (optimal solver, God's number,
 * random-state scrambles), and the facelet-graph model with its orbits.
 *
 * State: an array of color indices, one per sticker slot.
 * Turn:  { axis, cw, notation } - one turn by the puzzle's turn angle.
 */
import { rotate, distance, normalize, dot, cross, add, scale } from './geometry';
import { makeProjection } from '../faceletGraph';
import { MoveParseError } from '../cubeState';

const ORBIT_COLORS = ['#a78bfa', '#38bdf8', '#f472b6', '#a3e635', '#2dd4bf', '#f0abfc', '#fde68a'];
const CIRCLE_SAMPLES = 240;

function cyclesOf(perm) {
  const seen = new Uint8Array(perm.length);
  const cycles = [];
  for (let s = 0; s < perm.length; s++) {
    if (seen[s] || perm[s] === s) { seen[s] = 1; continue; }
    const cyc = [];
    for (let c = s; !seen[c]; c = perm[c]) { seen[c] = 1; cyc.push(c); }
    cycles.push(cyc);
  }
  return cycles;
}

export function buildPuzzle(def) {
  const stickers = def.stickers;
  const count = stickers.length;

  // ── Moves ────────────────────────────────────────────────────────────
  const axes = def.axes.map((axis, index) => ({
    ...axis,
    index,
    moving: stickers.map((s, i) => (def.turns(axis, s) ? i : -1)).filter(i => i >= 0),
  }));

  // moves[axis * 2 + (cw ? 0 : 1)]; perm[i] = slot the sticker at i moves to
  const moves = [];
  for (const axis of axes) {
    for (const cw of [true, false]) {
      // Clockwise seen from outside = negative rotation about the outward axis
      const angle = (cw ? -1 : 1) * def.turnAngle;
      const perm = Array.from({ length: count }, (_, i) => i);
      for (const i of axis.moving) {
        const p = rotate(stickers[i].center, axis.vector, angle);
        let best = -1, bestDist = Infinity;
        for (const j of axis.moving) {
          const d = distance(p, stickers[j].center);
          if (d < bestDist) { bestDist = d; best = j; }
        }
        if (bestDist > 1e-6) throw new Error(`${def.id}: turn ${axis.name} does not map sticker ${i} onto a sticker`);
        perm[i] = best;
      }
      moves.push({ axis: axis.index, cw, angle, name: axis.name + (cw ? '' : "'"), perm, cycles: cyclesOf(perm) });
    }
  }
  const moveOf = (turn) => moves[turn.axis * 2 + (turn.cw ? 0 : 1)];

  // ── State ────────────────────────────────────────────────────────────
  const solvedState = () => stickers.map(s => s.face);
  const applyTurn = (state, turn) => {
    const { perm } = moveOf(turn);
    const next = new Array(count);
    for (let i = 0; i < count; i++) next[perm[i]] = state[i];
    return next;
  };
  const isSolved = (state) => state.every((c, i) => c === stickers[i].face);

  // ── Notation: "F", "F'", "F2" (twice) ─────────────────────────────────
  const axisByName = Object.fromEntries(axes.map(a => [a.name, a]));
  const turn = (axis, cw) => ({ axis: axis.index, cw, notation: axis.name + (cw ? '' : "'") });
  const parseMoveSequence = (sequence) => {
    const tokens = (sequence || '').replace(/[()[\],]/g, ' ').trim().split(/\s+/).filter(Boolean);
    return tokens.flatMap(tok => {
      const m = /^([A-Za-z])(2?)('?)(2?)$/.exec(tok);
      const axis = m && axisByName[m[1].toUpperCase()];
      if (!axis) throw new MoveParseError(`Unknown move "${tok}"`);
      const cw = !m[3];
      const times = m[2] || m[4] ? 2 : 1;
      return Array.from({ length: times }, () => turn(axis, cw));
    });
  };
  const applyMoveSequence = (state, sequence) => parseMoveSequence(sequence).reduce(applyTurn, state);
  const generators = axes.map(a => turn(a, true));
  const allTurns = axes.flatMap(a => [turn(a, true), turn(a, false)]);

  // ── The whole group, by breadth-first search (computed on first use) ───
  let table = null;
  const keyOf = (state) => state.join(',');
  const enumerate = () => {
    if (table) return table;
    const dist = new Map();
    const keys = [];
    const start = solvedState();
    dist.set(keyOf(start), 0);
    keys.push(keyOf(start));
    let frontier = [start];
    const distribution = [1];
    for (let d = 1; frontier.length; d++) {
      const next = [];
      for (const st of frontier) {
        for (const t of allTurns) {
          const s2 = applyTurn(st, t);
          const k = keyOf(s2);
          if (!dist.has(k)) { dist.set(k, d); keys.push(k); next.push(s2); }
        }
      }
      if (next.length) distribution.push(next.length);
      frontier = next;
    }
    table = { dist, keys, distribution, order: keys.length, godsNumber: distribution.length - 1 };
    return table;
  };

  /** Optimal solution (fewest turns, each 120° turn counts as one) */
  const solve = (state) => {
    const { dist } = enumerate();
    let d = dist.get(keyOf(state));
    if (d === undefined) throw new Error('This position is not reachable');
    const out = [];
    let st = state;
    while (d > 0) {
      for (const t of allTurns) {
        const s2 = applyTurn(st, t);
        if (dist.get(keyOf(s2)) === d - 1) { out.push(t); st = s2; d--; break; }
      }
    }
    return out;
  };
  const distanceToSolved = (state) => enumerate().dist.get(keyOf(state));

  /** Random-state scramble: a uniformly random position, written as the inverse of its optimal solution */
  const randomScramble = () => {
    const { keys } = enumerate();
    const state = keys[Math.floor(Math.random() * keys.length)].split(',').map(Number);
    return solve(state).reverse().map(t => turn(axes[t.axis], !t.cw).notation).join(' ');
  };

  // ── Orbits: connected components under all moves ─────────────────────
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const mv of moves) for (const cyc of mv.cycles) for (const i of cyc) parent[find(i)] = find(cyc[0]);
  const groups = new Map();
  for (let i = 0; i < count; i++) {
    if (!groups.has(find(i))) groups.set(find(i), []);
    groups.get(find(i)).push(i);
  }
  const kindOrder = Object.keys(def.kinds);
  const pieceLabel = (piece) => piece.replace(/^(\w)(\w*)-(.*)$/, (_, a, b, name) => `${a.toUpperCase()}${b} ${name}`);
  const comps = [...groups.values()];
  // Single fixed stickers (a center on a turning axis) merge into one entry
  const fixedMembers = comps.filter(m => m.length === 1).flat();
  const rawOrbits = comps.filter(m => m.length > 1)
    .map(members => ({ members, kind: stickers[members[0]].kind }))
    .sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || a.members[0] - b.members[0]);
  const perKind = {};
  rawOrbits.forEach(o => { perKind[o.kind] = (perKind[o.kind] || 0) + 1; });
  const seenKind = {};
  const orbitOf = new Array(count);
  const orbits = rawOrbits.map((o, id) => {
    seenKind[o.kind] = (seenKind[o.kind] || 0) + 1;
    const pieces = new Set(o.members.map(i => stickers[i].piece));
    const label = pieces.size === 1 ? pieceLabel([...pieces][0])
      : perKind[o.kind] > 1 ? `${def.kinds[o.kind]} ${String.fromCharCode(64 + seenKind[o.kind])}`
      : def.kinds[o.kind];
    o.members.forEach(i => { orbitOf[i] = id; });
    return { id, kind: o.kind, label, members: o.members, color: ORBIT_COLORS[id % ORBIT_COLORS.length] };
  });
  if (fixedMembers.length) {
    const id = orbits.length;
    orbits.push({ id, kind: 'fixed', label: def.kinds[stickers[fixedMembers[0]].kind], members: fixedMembers, color: '#78716c' });
    fixedMembers.forEach(i => { orbitOf[i] = id; });
  }

  // ── Facelet graph model ──────────────────────────────────────────────
  const project = makeProjection(def.view);
  const nodes = stickers.map((s, i) => {
    const sphere = normalize(s.center);
    return { i, sphere, xy: project(sphere), orbit: orbitOf[i], face: s.face };
  });
  const circles = [];
  for (const axis of axes) {
    const byLat = new Map();
    for (const i of axis.moving) {
      const lat = dot(nodes[i].sphere, axis.vector);
      if (Math.abs(Math.abs(lat) - 1) < 1e-9) continue; // on the axis: spins in place
      const key = `${axis.index}:${lat.toFixed(5)}`;
      if (!byLat.has(key)) byLat.set(key, { key, axis: axis.index, lat, members: [] });
      byLat.get(key).members.push(i);
    }
    for (const c of byLat.values()) {
      // orthonormal frame around the axis
      const u = normalize(cross(axis.vector, Math.abs(axis.vector[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
      const w = cross(axis.vector, u);
      const rho = Math.sqrt(Math.max(0, 1 - c.lat * c.lat));
      const pts = [];
      for (let k = 0; k <= CIRCLE_SAMPLES; k++) {
        const t = (k / CIRCLE_SAMPLES) * 2 * Math.PI;
        pts.push(project(add(scale(axis.vector, c.lat), add(scale(u, rho * Math.cos(t)), scale(w, rho * Math.sin(t))))));
      }
      c.d = 'M' + pts.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join('L') + 'Z';
      c.extent = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
      c.type = 'belt';
      circles.push(c);
    }
  }
  let radius = 0, spacing = Infinity;
  nodes.forEach(n => { radius = Math.max(radius, Math.hypot(...n.xy)); });
  circles.forEach(c => { radius = Math.max(radius, c.extent); });
  for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) {
    spacing = Math.min(spacing, Math.hypot(nodes[a].xy[0] - nodes[b].xy[0], nodes[a].xy[1] - nodes[b].xy[1]));
  }
  const labels = (def.labels || axes.map(a => ({ name: a.name, point: a.vector })))
    .map(l => ({ name: l.name, xy: project(normalize(l.point)) }));

  const graph = {
    kind: 'generic',
    nodes, circles, orbits, radius, spacing, faceLabels: labels,
    colors: def.colors,
    colorOf: (state, i) => state[i],
    movingNodes: (t) => axes[t.axis].moving,
    circleKeysFor: (t) => new Set(circles.filter(c => c.axis === t.axis).map(c => c.key)),
    positionDuring: (i, t, frac) => project(rotate(nodes[i].sphere, axes[t.axis].vector, moveOf(t).angle * frac)),
    applyTurn,
    labelOf: (i) => `${def.faceNames[stickers[i].face]} ${stickers[i].kind}`,
    labelsOnDots: !!def.labelsOnDots,
  };

  /** A turn as a permutation of the graph: its cycles grouped by orbit */
  const describeTurn = (t) => {
    if (!t) return null;
    const cyc = moveOf(t).cycles;
    const parts = orbits
      .map(o => ({ id: o.id, label: o.label, color: o.color, count: cyc.filter(c => orbitOf[c[0]] === o.id).length }))
      .filter(p => p.count);
    return { notation: t.notation, total: cyc.length, parts, cycleLength: cyc[0]?.length ?? 0 };
  };
  graph.describeTurn = describeTurn;

  // ── Pieces: which are home, which are home but twisted, which moved ────
  const pieceSlots = {};
  stickers.forEach((st, i) => { (pieceSlots[st.piece] ??= []).push(i); });
  const pieceStatus = (state, piece) => {
    const slots = pieceSlots[piece];
    if (slots.every(i => state[i] === stickers[i].face)) return 'home';
    const want = slots.map(i => stickers[i].face).sort().join();
    const have = slots.map(i => state[i]).sort().join();
    return want === have && slots.length > 1 ? 'twisted' : 'moved';
  };
  /** Counts like { 'corner-twisted': 1, 'leaf-moved': 3 } */
  const pieceEffect = (state) => {
    const out = {};
    for (const piece of Object.keys(pieceSlots)) {
      const status = pieceStatus(state, piece);
      if (status === 'home') continue;
      const key = `${stickers[pieceSlots[piece][0]].kind}-${status}`;
      out[key] = (out[key] || 0) + 1;
    }
    return out;
  };

  return {
    ...def,
    stickerCount: count,
    pieceSlots, pieceStatus, pieceEffect,
    axes, moves, generators, allTurns,
    solvedState, applyTurn, isSolved,
    parseMoveSequence, applyMoveSequence,
    turnToNotation: (t) => t.notation,
    turnCycles: (t) => moveOf(t).cycles,
    enumerate, solve, distanceToSolved, randomScramble,
    orbits, graph, describeTurn,
  };
}
