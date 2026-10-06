import { useEffect, useRef } from 'react';
import GuidePanel from './GuidePanel';

/** The guided tour (the old Guide tab), as an optional dialog */
export default function TourDialog({ onClose, onFinish }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="tour-backdrop" onClick={onClose}>
      <div
        className="tour-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Guided tour"
        tabIndex={-1}
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
      >
        <button className="tour-close" onClick={onClose} aria-label="Close tour">✕</button>
        <GuidePanel onNavigate={onFinish} />
      </div>
    </div>
  );
}
