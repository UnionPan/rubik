import Section from './ui/Section';

/**
 * GenericPlayPanel - turn buttons for the geometry-engine puzzles: one row
 * per turning axis, clockwise and counter-clockwise.
 */
export default function GenericPlayPanel({ model, onTurn, disabled }) {
  const what = model.id === 'ivy' ? 'corner' : 'fixed face';
  return (
    <div className="panel-stack">
      <Section
        title="Turn"
        caption={`Each letter turns around one ${what}. Or drag a sticker, or use the keyboard.`}
        why={<p>
          Each turn is a <em>generator</em> of the puzzle&apos;s group: a 120° rotation that permutes
          the stickers in 3-cycles. Three turns the same way return to the start, so every generator
          has order 3.
        </p>}
      >
        <div className="gp-turn-grid">
          {model.axes.map(axis => (
            <div key={axis.name} className="gp-turn-row">
              <span className="gp-turn-axis">
                <span className="gp-turn-letter">{axis.name}</span>
                <span className="gp-turn-label">{axis.label}</span>
              </span>
              {[true, false].map(cw => {
                const turn = { axis: axis.index, cw, notation: axis.name + (cw ? '' : "'") };
                return (
                  <button
                    key={String(cw)}
                    className="gp-turn-btn"
                    disabled={disabled}
                    onClick={() => onTurn(turn)}
                    title={`${turn.notation}: turn around ${axis.label} ${cw ? 'clockwise' : 'counter-clockwise'}`}
                  >
                    {turn.notation} <span aria-hidden="true">{cw ? '↻' : '↺'}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Keyboard" className="keyboard-section">
        <div className="key-hint">
          {model.axes.map(a => <kbd key={a.name}>{a.name}</kbd>)} turn · <kbd>Shift</kbd> counter-clockwise
        </div>
      </Section>
    </div>
  );
}
