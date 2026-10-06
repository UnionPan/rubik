import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { FACE, applyTurn, turnToNotation } from '../lib/cubeState';
import { easeInOutQuad, tweenProgress } from '../lib/tween';
import { createStage } from './three/stage';

// Official WCA face colors
const FACE_COLOR_MAP = [
  '#FFFFFF', // U white
  '#B71234', // R red
  '#009B48', // F green
  '#FFD500', // D yellow
  '#FF5800', // L orange
  '#0046AD', // B blue
];
const INNER_COLOR = '#16130d';

// Rotation axis & sign for each face CW move
// Proved from coordinate geometry: rotating +Y layer CW (from above) = -π/2 around +Y
const FACE_ANIM = {
  U: { axis: new THREE.Vector3(0,  1, 0), sign: -1 },
  D: { axis: new THREE.Vector3(0,  1, 0), sign:  1 },
  R: { axis: new THREE.Vector3(1,  0, 0), sign: -1 },
  L: { axis: new THREE.Vector3(1,  0, 0), sign:  1 },
  F: { axis: new THREE.Vector3(0,  0, 1), sign: -1 },
  B: { axis: new THREE.Vector3(0,  0, 1), sign:  1 },
};

// After CW rotation, how do cubie logical coords change?
// Proved from axis rotation geometry:
//   U CW: (x,z) → (N-1-z, x)
//   D CW: (x,z) → (z, N-1-x)
//   R CW: (y,z) → (z, N-1-y)   [note: (y,z) → new (y,z) = (z, N-1-y)]
//   L CW: (y,z) → (N-1-z, y)
//   F CW: (x,y) → (y, N-1-x)
//   B CW: (x,y) → (N-1-y, x)
function updateCubieCoords(cubie, face, cw, N) {
  let { x, y, z } = cubie;
  if (!cw) {
    // CCW = 3 × CW; call this 3 times
    for (let i = 0; i < 3; i++) {
      const prev = { x, y, z };
      updateCubieCoordsCW(prev, face, N);
      ({ x, y, z } = prev);
    }
    cubie.x = x; cubie.y = y; cubie.z = z;
  } else {
    updateCubieCoordsCW(cubie, face, N);
  }
}

function updateCubieCoordsCW(cubie, face, N) {
  const { x, y, z } = cubie;
  switch (face) {
    case 'U': cubie.x = N-1-z; cubie.z = x;     break;
    case 'D': cubie.x = z;     cubie.z = N-1-x;  break;
    case 'R': cubie.y = z;     cubie.z = N-1-y;  break;
    case 'L': cubie.y = N-1-z; cubie.z = y;      break;
    case 'F': cubie.x = y;     cubie.y = N-1-x;  break;
    case 'B': cubie.x = N-1-y; cubie.y = x;      break;
  }
}

// Faces on the positive / negative end of each axis (x, y, z)
const AXIS_FACES = [['R', 'L'], ['U', 'D'], ['F', 'B']];

/**
 * The layer turn a drag across a sticker asks for.
 *   normal: outward normal of the touched sticker (a unit axis vector)
 *   dir:    in-plane direction the sticker should move (a unit axis vector)
 * Rotating about a = normal × dir by +90° carries the sticker along dir.
 */
function turnForDrag(cubie, normal, dir, N) {
  const a = new THREE.Vector3().crossVectors(normal, dir);
  const k = [Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)].indexOf(1);
  if (k < 0) return null;
  const sign = Math.sign([a.x, a.y, a.z][k]); // +1: counter-clockwise about +axis
  const coord = [cubie.x, cubie.y, cubie.z][k];
  const [posFace, negFace] = AXIS_FACES[k];
  // A clockwise turn of the positive face is −90° about +axis, of the negative face +90°
  const turn = coord >= N / 2
    ? { face: posFace, layers: [N - 1 - coord], cw: sign < 0 }
    : { face: negFace, layers: [coord], cw: sign > 0 };
  return { ...turn, notation: turnToNotation(turn, N) };
}

// Which cubies belong to a given face+layer slice?
function getCubiesInSlice(cubies, face, layer, N) {
  return cubies.filter(({ x, y, z }) => {
    switch (face) {
      case 'U': return y === N-1-layer;
      case 'D': return y === layer;
      case 'R': return x === N-1-layer;
      case 'L': return x === layer;
      case 'F': return z === N-1-layer;
      case 'B': return z === layer;
    }
  });
}

// Map logical cubie position to material colors from state
function getCubieColors(state, N, cx, cy, cz) {
  const colors = {
    '+x': INNER_COLOR, '-x': INNER_COLOR,
    '+y': INNER_COLOR, '-y': INNER_COLOR,
    '+z': INNER_COLOR, '-z': INNER_COLOR,
  };
  // R face (x=N-1): Three.js +X; R[r][c]: r=N-1-cy, c=N-1-cz
  if (cx === N-1) colors['+x'] = FACE_COLOR_MAP[state[FACE.R][N-1-cy][N-1-cz]];
  // L face (x=0):  Three.js -X; L[r][c]: r=N-1-cy, c=cz
  if (cx === 0)   colors['-x'] = FACE_COLOR_MAP[state[FACE.L][N-1-cy][cz]];
  // U face (y=N-1): Three.js +Y; U[r][c]: r=cz, c=cx
  if (cy === N-1) colors['+y'] = FACE_COLOR_MAP[state[FACE.U][cz][cx]];
  // D face (y=0):  Three.js -Y; D[r][c]: r=N-1-cz, c=cx
  if (cy === 0)   colors['-y'] = FACE_COLOR_MAP[state[FACE.D][N-1-cz][cx]];
  // F face (z=N-1): Three.js +Z; F[r][c]: r=N-1-cy, c=cx
  if (cz === N-1) colors['+z'] = FACE_COLOR_MAP[state[FACE.F][N-1-cy][cx]];
  // B face (z=0):  Three.js -Z; B[r][c]: r=N-1-cy, c=N-1-cx
  if (cz === 0)   colors['-z'] = FACE_COLOR_MAP[state[FACE.B][N-1-cy][N-1-cx]];
  return colors;
}

/**
 * CubeViewer3D
 * Props:
 *   state: 6×N×N array
 *   size: N
 *   highlightFace: 'U'|'R'|'F'|'D'|'L'|'B'|null
 *   animateMoveRef: ref — this component sets animateMoveRef.current =
 *                   fn(turn, durationMs, onComplete, startTime), where turn is
 *                   { face, layers, cw } (all layers rotate together)
 */
export default function CubeViewer3D({ state, size = 3, highlightFace = null, animateMoveRef = null, onTurn = null }) {
  const mountRef    = useRef(null);
  const sceneRef    = useRef(null);

  const onTurnRef = useRef(onTurn);
  useEffect(() => { onTurnRef.current = onTurn; }, [onTurn]);

  // Cubie registry: [{mesh, x, y, z}] — logical coords in 0..N-1
  const cubiesRef = useRef([]);

  // Current animation lock
  const animatingRef = useRef(false);

  // Keep latest state & size in refs for non-React callbacks
  const stateRef = useRef(state);
  const sizeRef  = useRef(size);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { sizeRef.current  = size;  }, [size]);

  // ── Build geometry (run once per size change) ──────────────────────────
  const buildCubies = useCallback((N, scene, initState) => {
    // Remove old cubies and free their GPU buffers
    cubiesRef.current.forEach(({ mesh }) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.forEach(m => m.dispose());
    });
    cubiesRef.current = [];

    // Scale cubie size inversely with N so cube always spans ~3 units total
    // N=2→1.4, N=3→1.0, N=4→0.75, N=5→0.6
    const dim  = 3.0 / N;
    const gap  = dim * 0.06;
    const off  = ((N-1) / 2) * (dim + gap);

    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        for (let z = 0; z < N; z++) {
          // Skip fully internal cubies
          if (x > 0 && x < N-1 && y > 0 && y < N-1 && z > 0 && z < N-1) continue;

          const geo = new THREE.BoxGeometry(dim, dim, dim);
          const fc  = getCubieColors(initState, N, x, y, z);

          // Three.js BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
          const mats = [
            new THREE.MeshLambertMaterial({ color: fc['+x'] }),
            new THREE.MeshLambertMaterial({ color: fc['-x'] }),
            new THREE.MeshLambertMaterial({ color: fc['+y'] }),
            new THREE.MeshLambertMaterial({ color: fc['-y'] }),
            new THREE.MeshLambertMaterial({ color: fc['+z'] }),
            new THREE.MeshLambertMaterial({ color: fc['-z'] }),
          ];

          const mesh = new THREE.Mesh(geo, mats);
          mesh.position.set(
            x * (dim + gap) - off,
            y * (dim + gap) - off,
            z * (dim + gap) - off,
          );
          scene.add(mesh);
          cubiesRef.current.push({ mesh, x, y, z });
        }
      }
    }
  }, []);

  // ── Refresh material colors from state (no geometry rebuild) ──────────
  const refreshColors = useCallback((st, N) => {
    const HIGHLIGHT_DIRS = { R: '+x', L: '-x', U: '+y', D: '-y', F: '+z', B: '-z' };
    const hl = highlightFace ? HIGHLIGHT_DIRS[highlightFace] : null;

    cubiesRef.current.forEach(({ mesh, x, y, z }) => {
      const fc = getCubieColors(st, N, x, y, z);
      const dirs = ['+x', '-x', '+y', '-y', '+z', '-z'];
      mesh.material.forEach((mat, i) => {
        mat.color.set(fc[dirs[i]]);
        mat.emissive.set(hl && hl === dirs[i] ? '#333333' : '#000000');
      });
    });
  }, [highlightFace]);

  // ── Three.js scene init (runs once) ───────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // The cube spans ~3.2 units; its bounding sphere has radius ≈ 2.9
    const stage = createStage(el, { boundingRadius: 2.9 });
    sceneRef.current = stage.scene;
    buildCubies(sizeRef.current, stage.scene, stateRef.current);

    // A drag that starts on a sticker turns that sticker's layer in the drag direction
    stage.setGestures({
      pick: (x, y) => {
        if (animatingRef.current) return null; // cubie coords are stale mid-turn
        const hit = stage.pick(x, y, cubiesRef.current.map(c => c.mesh));
        if (!hit) return null;
        const cubie = cubiesRef.current.find(c => c.mesh === hit.object);
        const normal = hit.face.normal.clone().round(); // meshes are unrotated between turns
        return { cubie, normal, point: hit.point };
      },
      onTurnDrag: ({ cubie, normal, point }, drag) => {
        // Pick the in-plane axis whose on-screen direction best matches the drag
        let best = null;
        for (const axis of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]) {
          if (Math.abs(axis.dot(normal)) > 0.5) continue;
          const step = stage.screenStep(point, axis);
          const len = step.length();
          if (len < 1e-6) continue;
          const score = drag.dot(step) / len;
          if (!best || Math.abs(score) > Math.abs(best.score)) best = { axis, score };
        }
        if (!best) return;
        const dir = best.axis.clone().multiplyScalar(Math.sign(best.score));
        const turn = turnForDrag(cubie, normal, dir, sizeRef.current);
        if (turn) onTurnRef.current?.(turn);
      },
    });

    return () => stage.dispose();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rebuild cubies when size changes ──────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return;
    buildCubies(size, sceneRef.current, state);
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh colors when state changes (no geometry rebuild) ───────────
  useEffect(() => {
    if (!sceneRef.current || animatingRef.current) return;
    refreshColors(state, size);
  }, [state, size, refreshColors]);

  // ── Highlight face ────────────────────────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return;
    refreshColors(stateRef.current, sizeRef.current);
  }, [highlightFace, refreshColors]);

  // ── Animate a quarter turn of one or more parallel layers ─────────────
  const animateSlice = useCallback((turn, durationMs = 280, onComplete, startTime) => {
    if (animatingRef.current || !sceneRef.current) {
      onComplete?.();
      return;
    }
    animatingRef.current = true;

    const { face, layers, cw } = turn;
    const N      = sizeRef.current;
    const scene  = sceneRef.current;
    const anim   = FACE_ANIM[face];
    const angle  = (Math.PI / 2) * anim.sign * (cw ? 1 : -1);

    // Collect cubies in the turning layers (wide moves and rotations turn several)
    const slice = layers.flatMap(layer => getCubiesInSlice(cubiesRef.current, face, layer, N));

    // Parent them to a pivot Group
    const pivot = new THREE.Group();
    scene.add(pivot);
    // Must match buildCubies scaling
    const dim = 3.0 / N;
    const gap = dim * 0.06;
    slice.forEach(({ mesh }) => {
      // Convert world position to pivot-local (pivot is at origin, so no transform needed)
      pivot.attach(mesh);
    });

    // Tween rotation
    // startTime lets the parent share one clock with the facelet graph
    const start    = startTime ?? performance.now();
    const quatStart = new THREE.Quaternion();
    const quatEnd   = new THREE.Quaternion();
    quatEnd.setFromAxisAngle(anim.axis, angle);

    // Two-phase finish strategy:
    //   The Three.js render loop RAF fires *before* the tick RAF in the same frame,
    //   so the "last" rendered frame shows t≈0.92 not t=1.  Without a hold frame, the
    //   renderer jumps from 92% → 0° (snapped) which looks like a flash.
    //   Phase 1 (first time t≥1): hold pivot at exact 100%, schedule phase 2.
    //   Phase 2 (next tick): do the reparent/snap/recolor — the render loop will draw
    //   the phase-1 "hold" frame first, then draw the correctly-snapped frame.
    let finalHeld = false;

    const tick = (now) => {
      const t  = tweenProgress(now, start, durationMs);
      const et = easeInOutQuad(t);
      pivot.quaternion.slerpQuaternions(quatStart, quatEnd, et);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else if (!finalHeld) {
        // Phase 1: pivot is already at quatEnd (et=1).  Let this render for one
        // frame so the user sees a complete 90° rotation before the snap.
        finalHeld = true;
        requestAnimationFrame(tick);
      } else {
        // Phase 2: reparent cubies back to scene, snap to grid
        const off = ((N-1) / 2) * (dim + gap);
        slice.forEach((cubie) => {
          scene.attach(cubie.mesh);
          // Update logical coords
          updateCubieCoords(cubie, face, cw, N);
          // Snap mesh position
          cubie.mesh.position.set(
            cubie.x * (dim + gap) - off,
            cubie.y * (dim + gap) - off,
            cubie.z * (dim + gap) - off,
          );
          // Snap mesh rotation to zero; colors refreshed below
          cubie.mesh.rotation.set(0, 0, 0);
        });

        scene.remove(pivot);
        animatingRef.current = false;

        // Compute post-move state directly — don't wait for React's async re-render.
        // stateRef.current is the pre-move state; onComplete calls setState (batched/
        // deferred), so we'd read stale state if we called refreshColors afterward.
        const postState = applyTurn(stateRef.current, turn);
        stateRef.current = postState;
        onComplete?.();
        refreshColors(postState, N);
      }
    };
    requestAnimationFrame(tick);
  }, [refreshColors]);

  // ── Expose animateSlice to parent ────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    if (animateMoveRef) animateMoveRef.current = animateSlice;
  }, [animateMoveRef, animateSlice]);

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', cursor: 'grab', userSelect: 'none', touchAction: 'none' }}
    />
  );
}
