/**
 * Segmented - a small group of mutually exclusive toggle buttons.
 *   options: [{ value, label }]
 */
export default function Segmented({ options, value, onChange, label }) {
  return (
    <div className="ui-segmented" role="group" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          className={`ui-segment${o.value === value ? ' active' : ''}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
