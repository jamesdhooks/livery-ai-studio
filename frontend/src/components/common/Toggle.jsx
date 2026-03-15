import React from 'react';

export function Toggle({ checked, onChange, label, disabled = false, size = 'md', id }) {
  const sizes = {
    sm: { track: 'w-6 h-3', thumb: 'w-2 h-2', translate: 'translate-x-3' },
    md: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <label
      className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      htmlFor={id}
    >
      <div className="relative flex-shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`
            ${s.track} rounded-full transition-colors duration-200
            ${checked ? 'bg-accent' : 'bg-border-default'}
          `}
        />
        <div
          className={`
            absolute top-0.5 left-0.5 ${s.thumb} rounded-full bg-white
            transition-transform duration-200
            ${checked ? s.translate : 'translate-x-0'}
          `}
        />
      </div>
      {label && <span className="text-xs text-text-secondary">{label}</span>}
    </label>
  );
}

export default Toggle;
