import { useContext, useId, useState } from 'react';
import { ExplainContext } from './explain';

/**
 * Section - the one building block for every panel.
 *
 *   title    short heading
 *   caption  optional one-line summary under the heading
 *   why      optional explanation, folded behind a "Why?" toggle
 *   aside    optional element at the right of the heading (e.g. a switch)
 *   children content, or a function (open) => content for sections whose
 *            content itself grows when explained
 *
 * The global Explain switch opens or closes every "Why?" at once; a section's
 * own toggle overrides it until the switch is flipped again.
 */
export default function Section({ title, caption, why, aside, children, className = '', style }) {
  const { explainAll, version } = useContext(ExplainContext);
  const [override, setOverride] = useState(null); // { open, version } | null
  const open = override && override.version === version ? override.open : explainAll;
  const whyId = useId();

  return (
    <section className={`ui-section ${className}`} style={style}>
      <header className="ui-section-head">
        <h4 className="ui-section-title">{title}</h4>
        {aside}
        {why && (
          <button
            type="button"
            className={`ui-why-btn${open ? ' open' : ''}`}
            aria-expanded={open}
            aria-controls={whyId}
            onClick={() => setOverride({ open: !open, version })}
          >
            Why? <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
        )}
      </header>
      {caption && <p className="ui-section-caption">{caption}</p>}
      {why && open && <div id={whyId} className="ui-why">{why}</div>}
      {typeof children === 'function' ? children(open) : children}
    </section>
  );
}
