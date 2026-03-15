import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * InfoTooltip — a small ⓘ icon that reveals explanatory text on hover.
 * Uses a portal so the tooltip is never clipped by overflow or z-index containers.
 *
 * @param {string}  text      — tooltip content (plain text)
 * @param {string}  [position='top'] — preferred position: 'top' | 'bottom' | 'left' | 'right'
 * @param {number}  [maxWidth=260] — max width in px
 * @param {string}  [className] — extra classes on the outer wrapper
 * @param {React.ReactNode} [children] — if provided, renders rich content instead of `text`
 */
export function InfoTooltip({ text, children, position = 'top', maxWidth = 260, className = '' }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const tipRef = useRef(null);

  const reposition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const gap = 6;

    // Default positions — will be adjusted if offscreen
    let top, left;
    if (position === 'bottom') {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2;
    } else if (position === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left - gap;
    } else if (position === 'right') {
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
    } else {
      // top (default)
      top = rect.top - gap;
      left = rect.left + rect.width / 2;
    }

    setCoords({ top, left });
  }, [position]);

  // Adjust tooltip position after it renders to prevent clipping
  useEffect(() => {
    if (!visible || !tipRef.current) return;
    const tip = tipRef.current;
    const tipRect = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { top, left } = coords;

    // Horizontal clamping
    if (tipRect.right > vw - 8) left -= tipRect.right - vw + 8;
    if (tipRect.left < 8) left += 8 - tipRect.left;
    // Vertical clamping
    if (tipRect.bottom > vh - 8) top -= tipRect.bottom - vh + 8;
    if (tipRect.top < 8) top += 8 - tipRect.top;

    if (top !== coords.top || left !== coords.left) {
      setCoords({ top, left });
    }
  }, [visible, coords]);

  const handleEnter = () => { reposition(); setVisible(true); };
  const handleLeave = () => setVisible(false);

  const transformOrigin = {
    top: 'translateX(-50%) translateY(-100%)',
    bottom: 'translateX(-50%)',
    left: 'translateX(-100%) translateY(-50%)',
    right: 'translateY(-50%)',
  };

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <button
        ref={btnRef}
        type="button"
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-text-muted/15 text-text-muted/70 hover:bg-accent/20 hover:text-accent transition-colors cursor-help"
        tabIndex={-1}
        aria-label="More info"
      >
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>
      {visible && createPortal(
        <div
          ref={tipRef}
          className="fixed bg-bg-card border border-border-default rounded-lg shadow-xl p-2.5 text-[11px] text-text-secondary leading-relaxed z-[9999] pointer-events-none"
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            maxWidth: `${maxWidth}px`,
            width: 'max-content',
            transform: transformOrigin[position] || transformOrigin.top,
          }}
        >
          {children || text}
        </div>,
        document.body,
      )}
    </span>
  );
}

export default InfoTooltip;
