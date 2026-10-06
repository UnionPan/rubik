import { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useState, useId } from 'react';
import { FACE_NAMES } from '../lib/cubeState';
import { easeInOutQuad, tweenProgress } from '../lib/tween';

const DOT_STROKE = '#0c0b09';

/**
 * FaceletGraph - a puzzle drawn as a colored graph.
 *
 * Every facelet is a vertex; the loops are the circles along which facelets
 * travel when a layer turns.  Animations are driven imperatively (no React
 * re-render per frame) from the same start time and easing as the 3D cube,
 * so both views move in lockstep.
 *
 * Mount with a key per puzzle: the vertex set depends on it.
 *
 * Props:
 *   graph                 - graph model (cubeGraphModel(N) or a puzzle's .graph)
 *   state                 - puzzle state
 *   highlightFace         - face letter to outline, or null
 *   animateRef            - ref; set to fn(turn, durationMs, startTime)
 *   focusOrbit            - orbit id to isolate, or null
 *   onFocusOrbit(id|null) - called when a vertex is clicked
 *   showOrbits            - draw each vertex's orbit as a colored ring
 *   onMoveChange(move)    - reports the turn currently shown ({ ...turn, running })
 */
export default function FaceletGraph({
  graph, state, highlightFace = null, animateRef = null,
  focusOrbit = null, onFocusOrbit = null, showOrbits = false, onMoveChange = null,
}) {
  const dotR = graph.spacing * 0.42;
  const pad = dotR * 2.2;
  const extent = graph.radius + pad;

  const dotRefs = useRef([]);
  const stateRef = useRef(state);
  const graphRef = useRef(graph);
  const animRef = useRef(null); // { turn, start, duration, moving, raf }
  const [move, setMove] = useState(null);

  const reportMove = useCallback((m) => {
    setMove(m);
    onMoveChange?.(m);
  }, [onMoveChange]);

  // ── Imperative painting ─────────────────────────────────────────────────
  const paint = useCallback((st) => {
    const g = graphRef.current;
    const els = dotRefs.current;
    for (const n of g.nodes) {
      const el = els[n.i];
      if (!el) continue;
      el.setAttribute('fill', g.colors[g.colorOf(st, n.i)]);
      el.setAttribute('cx', n.xy[0]);
      el.setAttribute('cy', n.xy[1]);
    }
  }, []);

  const finish = useCallback((anim) => {
    cancelAnimationFrame(anim.raf);
    animRef.current = null;
    const post = graphRef.current.applyTurn(stateRef.current, anim.turn);
    stateRef.current = post;
    // Each moving dot now sits exactly on its destination vertex carrying its
    // old color, which is the destination's new color - so recoloring and
    // snapping back in the same frame is visually seamless.
    paint(post);
    reportMove({ ...anim.turn, running: false });
  }, [paint, reportMove]);

  // Sync from props whenever no animation owns the dots
  useLayoutEffect(() => {
    graphRef.current = graph;
    if (animRef.current) return;
    stateRef.current = state;
    paint(state);
  }, [state, graph, paint]);

  // Stop a running animation on unmount
  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current.raf);
  }, []);

  const animate = useCallback((turn, duration, startTime) => {
    if (animRef.current) finish(animRef.current);
    const g = graphRef.current;
    const start = startTime ?? performance.now();
    const moving = g.movingNodes(turn);
    const anim = { turn, start, duration, moving, raf: 0 };
    animRef.current = anim;
    reportMove({ ...turn, running: true });

    const tick = (now) => {
      if (animRef.current !== anim) return;
      const t = tweenProgress(now, anim.start, anim.duration);
      const et = easeInOutQuad(t);
      for (const i of moving) {
        const el = dotRefs.current[i];
        if (!el) continue;
        const [x, y] = g.positionDuring(i, turn, et);
        el.setAttribute('cx', x);
        el.setAttribute('cy', y);
      }
      if (t < 1) anim.raf = requestAnimationFrame(tick);
      else finish(anim);
    };
    anim.raf = requestAnimationFrame(tick);
  }, [finish, reportMove]);

  useEffect(() => {
    if (!animateRef) return undefined;
    // eslint-disable-next-line react-hooks/immutability
    animateRef.current = animate;
    return () => {
      if (animateRef.current === animate) animateRef.current = null;
    };
  }, [animateRef, animate]);

  // ── Derived drawing data ────────────────────────────────────────────────
  const activeCircles = useMemo(() => {
    if (!move) return new Set();
    return graph.circleKeysFor(move);
  }, [graph, move]);

  // Schreier-graph edges of the current generator: x → g(x), drawn as the arc
  // each facelet travels along.  Trimmed so arrowheads clear the dots.
  const arcs = useMemo(() => {
    if (!move) return [];
    const STEPS = 24;
    return graph.movingNodes(move).flatMap(i => {
      const pts = [];
      for (let s = 0; s <= STEPS; s++) pts.push(graph.positionDuring(i, move, s / STEPS));
      const [x0, y0] = pts[0];
      const [x1, y1] = pts[STEPS];
      if (Math.hypot(x1 - x0, y1 - y0) < 1e-6) return []; // fixed point (face center)
      const trimmed = pts.filter(([x, y]) =>
        Math.hypot(x - x0, y - y0) > dotR * 1.05 && Math.hypot(x - x1, y - y1) > dotR * 1.45);
      if (trimmed.length < 2) return [];
      return [{ i, orbit: graph.nodes[i].orbit, d: 'M' + trimmed.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join('L') }];
    });
  }, [graph, move, dotR]);

  const orbitById = graph.orbits;
  const faceIdx = highlightFace ? FACE_NAMES.indexOf(highlightFace) : -1;
  const arrowId = `fg-arrow-${useId().replace(/:/g, '')}`;
  // Labels inside a dot, or in the gap between dots: cube poles have room, the
  // gaps around a 2×2 pole or an Ivy corner are tighter
  const labelScale = graph.labelsOnDots ? 1.05 : graph.kind === 'cube' && graph.N !== 2 ? 1.45 : 0.95;

  return (
    <svg
      className="facelet-graph"
      viewBox={`${-extent} ${-extent} ${2 * extent} ${2 * extent}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Facelet graph"
    >
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="7" refY="5" markerUnits="userSpaceOnUse"
          markerWidth={dotR * 0.95} markerHeight={dotR * 0.95} orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 z" fill="var(--fg-arc)" />
        </marker>
      </defs>

      {/* Latitude circles: belts (layer sides) and caps (faces spinning in place) */}
      <g fill="none">
        {graph.circles.map(c => {
          const active = activeCircles.has(c.key);
          return (
            <path key={c.key} d={c.d}
              className={`fg-circle fg-${c.type}${active ? ' active' : ''}${active && move?.running ? ' running' : ''}`}
              vectorEffect="non-scaling-stroke" />
          );
        })}
      </g>

      {/* Edges of the current generator */}
      {arcs.length > 0 && (
        <g className={`fg-arcs${move?.running ? ' running' : ''}`} fill="none">
          {arcs.map(a => (
            <path key={a.i} d={a.d} markerEnd={`url(#${arrowId})`}
              opacity={focusOrbit != null && a.orbit !== focusOrbit ? 0.15 : 1}
              vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      )}

      {/* Vertices */}
      <g>
        {graph.nodes.map(n => {
          const orbit = orbitById[n.orbit];
          const dimmed = focusOrbit != null && n.orbit !== focusOrbit;
          const onFace = n.face === faceIdx;
          return (
            <circle
              key={n.i}
              ref={el => { dotRefs.current[n.i] = el; }}
              r={dotR}
              className={`fg-dot${onFace ? ' on-face' : ''}`}
              stroke={showOrbits ? orbit.color : (onFace ? '#fff' : DOT_STROKE)}
              strokeWidth={showOrbits ? dotR * 0.34 : (onFace ? dotR * 0.3 : dotR * 0.16)}
              opacity={dimmed ? 0.14 : 1}
              onClick={() => onFocusOrbit?.(focusOrbit === n.orbit ? null : n.orbit)}
            >
              <title>{`${graph.labelOf(n.i)} · ${orbit.label} orbit`}</title>
            </circle>
          );
        })}
      </g>

      {/* Face (or axis) labels; on odd cubes they sit inside the fixed center dot */}
      <g className={`fg-face-labels${graph.labelsOnDots ? ' on-dot' : ''}`} pointerEvents="none">
        {graph.faceLabels.map(({ name, xy }) => (
          <text key={name} x={xy[0]} y={xy[1]} fontSize={dotR * labelScale}
            textAnchor="middle" dominantBaseline="central"
            strokeWidth={dotR * 0.22}>{name}</text>
        ))}
      </g>
    </svg>
  );
}
