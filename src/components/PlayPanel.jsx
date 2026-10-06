import MoveControls from './MoveControls';
import Section from './ui/Section';

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

/**
 * PlayPanel - turning the cube: move buttons, face highlight, keyboard and
 * notation reference.
 */
export default function PlayPanel({ cubeSize, onMove, disabled, highlightFace, onHighlightFace }) {
  return (
    <div className="panel-stack">
      <Section
        title="Turn a layer"
        caption="Or drag a sticker on the cube, or use the keyboard."
        why={<p>
          Each turn is a <em>generator</em> of the cube group: a permutation of the stickers.
          Doing turns one after another composes them; the Math tab shows the result live.
        </p>}
      >
        <MoveControls cubeSize={cubeSize} onMove={onMove} disabled={disabled} />
      </Section>

      <Section title="Highlight a face">
        <div className="face-highlight-row" role="group" aria-label="Highlight a face">
          {FACES.map(f => (
            <button key={f}
              className={`face-btn ${highlightFace === f ? 'active' : ''}`}
              aria-pressed={highlightFace === f}
              onClick={() => onHighlightFace(highlightFace === f ? null : f)}
            >{f}</button>
          ))}
        </div>
      </Section>

      <Section
        title="Keyboard"
        className="keyboard-section"
        why={<table className="notation-table">
          <tbody>
            <tr><td><code>R U F D L B</code></td><td>outer face, clockwise</td></tr>
            <tr><td><code>R&apos;</code> · <code>R2</code></td><td>counter-clockwise · half turn</td></tr>
            <tr><td><code>2R</code> · <code>3R</code></td><td>a single inner layer</td></tr>
            <tr><td><code>Rw</code> · <code>r</code> · <code>3Rw</code></td><td>outer 2 (or n) layers</td></tr>
            <tr><td><code>M E S</code></td><td>middle slice(s), following L, D, F</td></tr>
            <tr><td><code>x y z</code></td><td>whole-cube rotation, following R, U, F</td></tr>
          </tbody>
        </table>}
      >
        <div className="key-hint">
          <kbd>R</kbd><kbd>U</kbd><kbd>F</kbd><kbd>D</kbd><kbd>L</kbd><kbd>B</kbd> turn
          · <kbd>Shift</kbd> ′ · <kbd>Alt</kbd> wide
          {cubeSize >= 3 && <> · <kbd>M</kbd><kbd>E</kbd><kbd>S</kbd> slice</>}
          {' '}· <kbd>X</kbd><kbd>Y</kbd><kbd>Z</kbd> rotate
        </div>
      </Section>
    </div>
  );
}
