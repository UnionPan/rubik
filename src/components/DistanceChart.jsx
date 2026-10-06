/**
 * DistanceChart - how many positions lie at each distance from solved:
 * the layers of the puzzle's Cayley graph.  Highlights the current position's layer.
 */
export default function DistanceChart({ distribution, current = null }) {
  const max = Math.max(...distribution);
  return (
    <div className="dist-chart" role="table" aria-label="Positions by distance from solved">
      {distribution.map((count, d) => (
        <div key={d} role="row" className={`dist-row${d === current ? ' current' : ''}`}>
          <span role="cell" className="dist-d">{d}</span>
          <span role="cell" className="dist-bar-cell">
            <span className="dist-bar" style={{ width: `${Math.max(0.6, (count / max) * 100)}%` }} />
          </span>
          <span role="cell" className="dist-count">{count.toLocaleString('en-US')}</span>
        </div>
      ))}
    </div>
  );
}
