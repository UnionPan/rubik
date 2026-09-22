import { useRef, useState } from 'react';

/**
 * Splitter - a vertical drag handle between two panes.
 *
 * It occupies no layout width; its hit area overhangs both neighbours.
 * Props:
 *   onDrag(clientX)  - pointer moved to clientX while dragging
 *   onStep(deltaPx)  - keyboard nudge (arrow keys; Shift for bigger steps)
 *   onReset()        - double-click / Home: back to the default size
 *   label            - accessible name
 *   valueNow         - current size in percent, for assistive tech
 */
export default function Splitter({ onDrag, onStep, onReset, label, valueNow }) {
  const [dragging, setDragging] = useState(false);
  const pointerId = useRef(null);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!dragging || e.pointerId !== pointerId.current) return;
    onDrag(e.clientX);
  };
  const endDrag = (e) => {
    if (e.pointerId !== pointerId.current) return;
    pointerId.current = null;
    setDragging(false);
  };
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === 'ArrowLeft') { e.preventDefault(); onStep(-step); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); onStep(step); }
    else if (e.key === 'Home') { e.preventDefault(); onReset(); }
  };

  return (
    <div
      className={`splitter${dragging ? ' dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={valueNow != null ? Math.round(valueNow) : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      title={`${label} - drag to resize, double-click to reset`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
