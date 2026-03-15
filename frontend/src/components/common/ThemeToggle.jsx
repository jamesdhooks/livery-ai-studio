import React from 'react';

const MODES = [
  { id: 'light', label: 'Light', icon: SunIcon },
  { id: 'dark', label: 'Dark', icon: MoonIcon },
  { id: 'auto', label: 'Auto', icon: MonitorIcon },
];

/**
 * ThemeToggle — compact segmented control for light / dark / auto.
 */
export function ThemeToggle({ theme, onThemeChange }) {
  return (
    <div className="flex items-center rounded-md border border-border-default overflow-hidden bg-bg-input h-[30px]">
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onThemeChange(id)}
          title={label}
          className={`
            flex items-center justify-center w-[26px] h-full transition-all cursor-pointer
            ${theme === id
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
            }
          `}
        >
          <Icon className="w-3 h-3" />
        </button>
      ))}
    </div>
  );
}

function SunIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function MonitorIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export default ThemeToggle;
