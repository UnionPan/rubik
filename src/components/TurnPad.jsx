import { useEffect, useRef, useState } from 'react';

const FACE_META = {
  U: { bg: '#F5F0E8', fg: '#111', name: 'top' },
  R: { bg: '#B71234', fg: '#fff', name: 'right' },
  F: { bg: '#009B48', fg: '#fff', name: 'front' },
  D: { bg: '#FFD500', fg: '#111', name: 'bottom' },
  L: { bg: '#FF5800', fg: '#fff', name: 'left' },
  B: { bg: '#0046AD', fg: '#fff', name: 'back' },
};
const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

/**
 * TurnPad - the controls under the 3D puzzle: one button per face (or axis),
 * a direction switch, a layer picker on big cubes, speed, and keyboard help.
 * Mount with a key per puzzle so the layer resets.
 */
export default function TurnPad({
  model, onTurn, disabled,
  speed, onSpeedChange, instantTurns, prefersReducedMotion, animateAnyway, onToggleAnimate,
}) {
  const isCube = model.kind === 'cube';
  const [reverse, setReverse] = useState(false);
  const [layer, setLayer] = useState(0);
  const layers = isCube && model.N >= 4 ? Array.from({ length: model.N - 2 }, (_, i) => i) : [0];

  // Shift-click turns the other way once, like Shift on the keyboard
  const turnCw = (e) => !(reverse !== e.shiftKey);
  const mark = reverse ? '′' : '';

  return (
    <div className="turn-pad">
      <div className="tp-row">
        <div className="tp-turns" role="group" aria-label="Turn">
          {isCube ? FACES.map(face => {
            const m = FACE_META[face];
            const label = `${layer > 0 ? layer + 1 : ''}${face}${mark}`;
            return (
              <button key={face} className="tp-btn tp-face" disabled={disabled}
                style={{ '--tp-bg': m.bg, '--tp-fg': m.fg }}
                title={`Turn the ${layer > 0 ? `layer ${layer + 1} from the ` : ''}${m.name} face`}
                onClick={(e) => {
                  const cw = turnCw(e);
                  onTurn({ face, layers: [layer], cw, notation: `${layer > 0 ? layer + 1 : ''}${face}${cw ? '' : "'"}` });
                }}
              >{label}</button>
            );
          }) : model.axes.map(axis => (
            <button key={axis.name} className="tp-btn tp-axis" disabled={disabled}
              title={`Turn around the ${axis.label} corner`}
              onClick={(e) => {
                const cw = turnCw(e);
                onTurn({ axis: axis.index, cw, notation: axis.name + (cw ? '' : "'") });
              }}
            >{axis.name}{mark}</button>
          ))}
        </div>
        <button
          className={`tp-btn tp-dir${reverse ? ' on' : ''}`}
          onClick={() => setReverse(r => !r)}
          aria-pressed={reverse}
          title={reverse ? 'Turning counter-clockwise. Click to turn clockwise.' : 'Turning clockwise. Click to turn counter-clockwise.'}
        >
          <span aria-hidden="true">{reverse ? '↺' : '↻'}</span>
          <span className="tp-dir-text">{reverse ? 'Counter-clockwise' : 'Clockwise'}</span>
        </button>
      </div>

      <div className="tp-row tp-row-small">
        {layers.length > 1 && (
          <div className="tp-layers" role="group" aria-label="Layer">
            <span className="tp-label">Layer</span>
            {layers.map(l => (
              <button key={l} className={`tp-layer${layer === l ? ' on' : ''}`}
                onClick={() => setLayer(l)} aria-pressed={layer === l}
                title={l === 0 ? 'Outer layer' : `Layer ${l + 1}, counted in from the face`}
              >{l + 1}</button>
            ))}
          </div>
        )}
        <label className="tp-speed">
          <span className="tp-label">Speed</span>
          <input type="range" min="0.5" max="5" step="0.5" value={speed}
            onChange={e => onSpeedChange(parseFloat(e.target.value))}
            disabled={instantTurns} aria-label="Animation speed" />
        </label>
        {prefersReducedMotion && (
          <button className="tp-chip" onClick={onToggleAnimate}
            title="Your system asks for reduced motion, so turns are instant unless you switch animation on">
            {animateAnyway ? 'Animated' : 'Instant'}
          </button>
        )}
        <KeyboardHelp model={model} />
      </div>
    </div>
  );
}

function KeyboardHelp({ model }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isCube = model.kind === 'cube';
  return (
    <div className="tp-keys" ref={ref}>
      <button className={`tp-chip${open ? ' on' : ''}`} onClick={() => setOpen(o => !o)}
        aria-expanded={open} title="Keyboard shortcuts">Keyboard</button>
      {open && (
        <div className="tp-keys-pop" role="dialog" aria-label="Keyboard shortcuts">
          {isCube ? (
            <ul>
              <li><Keys k="RUFDLB" /> turn that face.</li>
              <li>Hold <kbd>Shift</kbd> to turn it the other way.</li>
              {model.N >= 3 && <li>Hold <kbd>Alt</kbd> to turn two layers at once.</li>}
              {model.N >= 3 && <li><Keys k="MES" /> turn a middle layer.</li>}
              <li><Keys k="XYZ" /> turn the whole cube.</li>
            </ul>
          ) : (
            <ul>
              <li><Keys k={model.axes.map(a => a.name).join('')} /> turn around that corner.</li>
              <li>Hold <kbd>Shift</kbd> to turn it the other way.</li>
            </ul>
          )}
          <p>You can also drag a sticker on the puzzle.</p>
        </div>
      )}
    </div>
  );
}

function Keys({ k }) {
  return <span className="tp-kbds">{k.split('').map(c => <kbd key={c}>{c}</kbd>)}</span>;
}
