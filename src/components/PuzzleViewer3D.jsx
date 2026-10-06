import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { createStage } from './three/stage';
import { easeInOutQuad, tweenProgress } from '../lib/tween';

const FOUNDATION_COLOR = '#16130d';
const STICKER_INSET = 0.9;    // stickers shrink toward their centre, leaving dark gaps
const STICKER_LIFT = 0.012;   // and sit just above the foundation

/** Fan-triangulated flat polygon from a list of [x,y,z] points */
function polygonGeometry(points, anchor) {
  const pos = [];
  for (let k = 0; k < points.length; k++) {
    const a = points[k], b = points[(k + 1) % points.length];
    pos.push(...anchor, ...a, ...b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

const shrink = (pts, toward, f) => pts.map(p => p.map((v, i) => toward[i] + (v - toward[i]) * f));
const lift = (pts, n, d) => pts.map(p => p.map((v, i) => v + n[i] * d));

/**
 * PuzzleViewer3D - renders any puzzle from the geometry engine.
 * Props:
 *   puzzle         built puzzle model (lib/puzzles)
 *   state          color index per sticker slot
 *   animateMoveRef this component sets animateMoveRef.current =
 *                  fn(turn, durationMs, onComplete, startTime)
 *   onTurn(turn)   a drag on a sticker asks for this turn
 */
export default function PuzzleViewer3D({ puzzle, state, animateMoveRef = null, onTurn = null }) {
  const mountRef = useRef(null);
  const stageRef = useRef(null);
  const slotsRef = useRef([]); // per sticker slot: { group, sticker (mesh) }
  const animatingRef = useRef(false);
  const stateRef = useRef(state);
  const puzzleRef = useRef(puzzle);
  const onTurnRef = useRef(onTurn);
  useEffect(() => { onTurnRef.current = onTurn; }, [onTurn]);

  const paint = useCallback((st) => {
    const { colors } = puzzleRef.current;
    slotsRef.current.forEach(({ sticker }, i) => sticker.material.color.set(colors[st[i]]));
  }, []);

  // ── Scene, built once per puzzle ──────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return undefined;
    puzzleRef.current = puzzle;
    const scale = puzzle.displayScale;
    const stage = createStage(el, { boundingRadius: 2.9 });
    stageRef.current = stage;

    const root = new THREE.Group();
    root.scale.setScalar(scale);
    stage.scene.add(root);

    const foundationMat = new THREE.MeshLambertMaterial({ color: FOUNDATION_COLOR, side: THREE.DoubleSide });
    slotsRef.current = puzzle.stickers.map((s, slot) => {
      const centroid = s.outline.reduce((acc, p) => acc.map((v, i) => v + p[i] / s.outline.length), [0, 0, 0]);
      const group = new THREE.Group();
      const foundation = new THREE.Mesh(polygonGeometry(s.outline, s.anchor), foundationMat);
      const sticker = new THREE.Mesh(
        polygonGeometry(
          lift(shrink(s.outline, centroid, STICKER_INSET), s.normal, STICKER_LIFT / scale),
          lift(shrink([s.anchor], centroid, STICKER_INSET), s.normal, STICKER_LIFT / scale)[0],
        ),
        new THREE.MeshLambertMaterial({ color: puzzle.colors[s.face], side: THREE.DoubleSide }),
      );
      foundation.userData.slot = slot;
      sticker.userData.slot = slot;
      group.add(foundation, sticker);
      root.add(group);
      return { group, sticker, foundation };
    });
    paint(stateRef.current);

    // Drag on a sticker: of the turns that move it, take the one whose on-screen
    // motion of that sticker best matches the drag direction.
    stage.setGestures({
      pick: (x, y) => {
        if (animatingRef.current) return null;
        const hit = stage.pick(x, y, slotsRef.current.flatMap(s => [s.sticker, s.foundation]));
        return hit ? { slot: hit.object.userData.slot, point: hit.point } : null;
      },
      onTurnDrag: ({ slot }, drag) => {
        const p = puzzleRef.current;
        const center = new THREE.Vector3(...p.stickers[slot].center).multiplyScalar(scale);
        let best = null;
        for (const t of p.allTurns) {
          const axis = p.axes[t.axis];
          if (!axis.moving.includes(slot)) continue;
          const u = new THREE.Vector3(...axis.vector);
          // velocity of the sticker under the turn: (sign · u) × c
          const v = u.clone().cross(center).multiplyScalar(t.cw ? -1 : 1);
          if (v.lengthSq() < 1e-9) continue;
          const step = stage.screenStep(center, v.normalize());
          const score = drag.dot(step) / (step.length() || 1);
          if (!best || score > best.score) best = { t, score };
        }
        if (best && best.score > 0) onTurnRef.current?.(best.t);
      },
    });

    return () => {
      stage.dispose();
      stageRef.current = null;
      slotsRef.current = [];
    };
  }, [puzzle, paint]);

  // ── Recolor when the state changes (outside animations) ───────────────
  useEffect(() => {
    stateRef.current = state;
    if (!animatingRef.current) paint(state);
  }, [state, paint]);

  // ── Animate one turn ──────────────────────────────────────────────────
  const animateTurn = useCallback((turn, durationMs = 280, onComplete, startTime) => {
    const stage = stageRef.current;
    if (animatingRef.current || !stage) { onComplete?.(); return; }
    animatingRef.current = true;
    const p = puzzleRef.current;
    const axis = p.axes[turn.axis];
    const angle = (turn.cw ? -1 : 1) * p.turnAngle;
    const root = slotsRef.current[0].group.parent;
    const pivot = new THREE.Group();
    root.add(pivot);
    const moving = axis.moving.map(i => slotsRef.current[i].group);
    moving.forEach(g => pivot.attach(g));
    const u = new THREE.Vector3(...axis.vector);
    const qEnd = new THREE.Quaternion().setFromAxisAngle(u, angle);
    const qStart = new THREE.Quaternion();
    const start = startTime ?? performance.now();
    let finalHeld = false;

    const tick = (now) => {
      const t = tweenProgress(now, start, durationMs);
      pivot.quaternion.slerpQuaternions(qStart, qEnd, easeInOutQuad(t));
      if (t < 1) { requestAnimationFrame(tick); return; }
      // Show the completed turn for one frame before snapping back (see CubeViewer3D)
      if (!finalHeld) { finalHeld = true; requestAnimationFrame(tick); return; }
      moving.forEach(g => {
        root.attach(g);
        g.position.set(0, 0, 0);
        g.quaternion.identity();
      });
      root.remove(pivot);
      animatingRef.current = false;
      const post = p.applyTurn(stateRef.current, turn);
      stateRef.current = post;
      onComplete?.();
      paint(post);
    };
    requestAnimationFrame(tick);
  }, [paint]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    if (animateMoveRef) animateMoveRef.current = animateTurn;
  }, [animateMoveRef, animateTurn]);

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', cursor: 'grab', userSelect: 'none', touchAction: 'none' }}
    />
  );
}
