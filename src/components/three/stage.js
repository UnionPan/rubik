import * as THREE from 'three';

/**
 * A three.js stage shared by the puzzle viewers: scene, lights, a camera that
 * orbits the origin and keeps a sphere of `boundingRadius` in frame, the
 * render loop and resizing.
 *
 * Gestures: a drag that starts on the puzzle is handed to `onTurnDrag` once
 * it has moved a few pixels (so the viewer can turn a layer); a drag that
 * starts on the background orbits the camera.
 */
const DRAG_THRESHOLD_PX = 10;

// Default view: looking down at the URF corner (U on top, F left, R right),
// the same corner the facelet graph is centred on.
export function createStage(el, { boundingRadius, view = { theta: 0.62, phi: 0.5 } }) {
  const w = el.clientWidth || 420;
  const h = el.clientHeight || 420;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#100e0a');

  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);

  // Physically based light units (three r155+): Lambert shading divides by π,
  // so these values put a lit top face at full white while the sides keep
  // visible shading (≈ 0.83 and 0.72 of full brightness in linear light).
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const dir = new THREE.DirectionalLight(0xffffff, 2.3);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  el.appendChild(renderer.domElement);

  const rot = { ...view };

  // Distance that keeps the bounding sphere in frame for both the vertical
  // FOV and, in narrow viewports, the horizontal one.
  const fitRadius = () => {
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    return Math.max(9, boundingRadius / Math.sin(Math.min(vHalf, hHalf)));
  };
  const updateCamera = () => {
    const radius = fitRadius();
    const phi = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, rot.phi));
    camera.position.set(
      radius * Math.cos(phi) * Math.sin(rot.theta),
      radius * Math.sin(phi),
      radius * Math.cos(phi) * Math.cos(rot.theta),
    );
    camera.lookAt(0, 0, 0);
  };

  let frame = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    updateCamera();
    renderer.render(scene, camera);
  };
  loop();

  const ro = new ResizeObserver(() => {
    camera.aspect = el.clientWidth / el.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(el.clientWidth, el.clientHeight);
  });
  ro.observe(el);

  // ── Picking and screen-space helpers ──
  const raycaster = new THREE.Raycaster();
  const pick = (clientX, clientY, objects) => {
    const rect = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(objects, false)[0] ?? null;
  };
  /** Screen displacement (pixels, y down) of a small world step from p along u */
  const screenStep = (p, u, step = 0.5) => {
    const rect = el.getBoundingClientRect();
    const a = p.clone().project(camera);
    const b = p.clone().addScaledVector(u, step).project(camera);
    return new THREE.Vector2(((b.x - a.x) * rect.width) / 2, (-(b.y - a.y) * rect.height) / 2);
  };

  // ── Gestures ──
  let gestureHandlers = null;
  let gesture = null; // { mode: 'orbit' | 'turn' | 'done', id, x, y, hit }
  const onPointerDown = (e) => {
    if (e.button !== 0 || gesture) return;
    const hit = gestureHandlers?.pick(e.clientX, e.clientY) ?? null;
    gesture = { mode: hit ? 'turn' : 'orbit', id: e.pointerId, x: e.clientX, y: e.clientY, hit };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    if (gesture.mode === 'orbit') {
      gesture.x = e.clientX;
      gesture.y = e.clientY;
      // Drag right → the puzzle appears to rotate right → camera orbits left
      rot.theta -= dx * 0.012;
      rot.phi += dy * 0.012; // drag down → camera rises → see more of the top
      return;
    }
    if (gesture.mode !== 'turn' || Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    gesture.mode = 'done';
    gestureHandlers?.onTurnDrag(gesture.hit, new THREE.Vector2(dx, dy));
  };
  const onPointerUp = (e) => {
    if (gesture && e.pointerId === gesture.id) gesture = null;
  };
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  return {
    scene, camera, renderer, rot, pick, screenStep,
    /** pick(x, y) → hit | null decides whether a drag turns; onTurnDrag(hit, drag) turns */
    setGestures: (handlers) => { gestureHandlers = handlers; },
    dispose: () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      ro.disconnect();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    },
  };
}
