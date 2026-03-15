import React, { useState, useCallback } from 'react';

const TOOLTIP_W = 800;
const OFFSET_X = 20;
const OFFSET_Y = 20;

/**
 * HoverImageTooltip
 *
 * Wraps any element (typically an <img>) and shows a large floating preview
 * that follows the cursor. Also renders an "expand" hint overlay on hover.
 *
 * Props:
 *   src       — image URL for the large tooltip preview
 *   alt       — alt text for the tooltip image
 *   children  — the trigger element (rendered as-is)
 *   className — extra classes for the wrapper div
 */
export function HoverImageTooltip({ src, alt = '', children, className = '' }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  const handleMouseMove = useCallback((e) => {
    setPos({ x: e.clientX, y: e.clientY });
  }, []);

  // Clamp tooltip to viewport
  const left = Math.min(pos.x + OFFSET_X, window.innerWidth - TOOLTIP_W - 12);
  const top = Math.max(pos.y - OFFSET_Y - 480, 12);

  return (
    <>
      <div
        className={`relative group cursor-zoom-in ${className}`}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onMouseMove={handleMouseMove}
      >
        {children}

        {/* "Hover to expand" hint overlay */}
        <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
          <span className="flex items-center gap-1 text-[10px] font-medium text-white bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md select-none">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            hover to expand
          </span>
        </div>
      </div>

      {/* Floating large preview — fixed, follows cursor */}
      {visible && (
        <div
          className="pointer-events-none fixed z-[9999] rounded-xl overflow-hidden shadow-2xl border border-border-default bg-bg-dark"
          style={{
            left,
            top,
            width: TOOLTIP_W,
            maxWidth: 'calc(100vw - 24px)',
          }}
        >
          <img src={src} alt={alt} className="w-full h-auto block" />
        </div>
      )}
    </>
  );
}

export default HoverImageTooltip;
