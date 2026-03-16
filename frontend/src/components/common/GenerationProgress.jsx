import React from 'react';

/**
 * GenerationProgress — animated progress bar with elapsed time, slow warning,
 * and a Cancel button.
 *
 * Shown during AI generation (livery or specular map).
 *
 * @param {Object}   props
 * @param {boolean}  props.generating      - Whether generation is active
 * @param {number}   props.elapsedSeconds  - Real elapsed seconds from the hook
 * @param {Function} props.onAbort         - Abort/cancel handler
 * @param {number}   [props.expectedMax=30]- Seconds at which bar reaches ~95%
 * @param {number}   [props.slowThreshold=40] - Seconds after which "taking long" warning shows
 */
export function GenerationProgress({
  generating,
  elapsedSeconds,
  onAbort,
  expectedMax = 30,
  slowThreshold = 40,
}) {
  if (!generating) return null;

  // Progress: eases from 0→~95% over expectedMax seconds, never reaches 100% until done
  const raw = elapsedSeconds / expectedMax;
  const progress = Math.min(95, raw * 100 * (1 - raw * 0.3));

  const isSlow = elapsedSeconds >= slowThreshold;

  const formatTime = (s) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Progress bar */}
      <div className="w-full h-2 bg-bg-input rounded-full overflow-hidden border border-border-default">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${isSlow ? 'bg-warning' : 'bg-accent'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Spinner */}
          <svg
            className="animate-spin flex-shrink-0 text-accent"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>

          <span className={`text-[11px] font-mono tabular-nums ${isSlow ? 'text-warning' : 'text-text-muted'}`}>
            {formatTime(elapsedSeconds)}
          </span>

          {isSlow && (
            <span className="text-[10px] text-warning flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Taking longer than expected — Gemini may be slow
            </span>
          )}

          {!isSlow && (
            <span className="text-[10px] text-text-muted">
              ~15–30s expected
            </span>
          )}
        </div>

        {/* Cancel button */}
        {onAbort && (
          <button
            onClick={onAbort}
            className="flex-shrink-0 text-[11px] text-text-secondary hover:text-error border border-border-default hover:border-error/50 rounded px-2 py-0.5 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
