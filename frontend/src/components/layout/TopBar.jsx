import React from 'react';
import { ThemeToggle } from '../common/ThemeToggle';

// ── Tab icon components ───────────────────────────────────────────────────────

function IconHome({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconGemini({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L13.5 9.5L20 12L13.5 14.5L12 22L10.5 14.5L4 12L10.5 9.5L12 2Z" />
    </svg>
  );
}

function IconClock({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconCar({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14l4 4v6a2 2 0 01-2 2h-2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />
    </svg>
  );
}

function IconZap({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconUsers({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconBadge({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}

function IconShine({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" /><path d="M9.09 9a3 3 0 005.83 1c0 2-3 3-3 3" /><path d="M15 16c0 1.66-.73 3.14-1.88 4.12M9 20.12C10.14 21.14 11.67 22 13.5 22" />
    </svg>
  );
}

function IconCog({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'getting-started', label: 'Getting Started', Icon: IconHome },
  { id: 'generate',        label: 'Generate',        Icon: IconGemini },
  { id: 'history',         label: 'History',          Icon: IconClock },
  { id: 'upscale',         label: 'Upscale',          Icon: IconZap },
  { id: 'sponsors',        label: 'Sponsors',         Icon: IconBadge, soon: true },
  { id: 'specular',        label: 'Specular',         Icon: IconShine, soon: true },
  { id: 'cars',            label: 'Cars',             Icon: IconCar },
  { id: 'settings',        label: 'Settings',         Icon: IconCog },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function TopBar({ activeTab, onTabChange, totalSpend, spendFilter = 'overall', onSpendingClick, historyLoading, theme, onThemeChange }) {
  const spendLabel = spendFilter === 'today' ? 'Today' : spendFilter === 'week' ? 'This Week' : 'Total';
  return (
    <header className="h-12 min-h-12 bg-bg-panel border-b border-border-default relative flex items-center px-3 flex-shrink-0 z-[100]">
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <img src="/icon.png" alt="" width="22" height="22" className="flex-shrink-0 rounded-sm" />
        <span className="text-[15px] font-bold text-text-primary whitespace-nowrap">
          Livery <span className="text-accent-teal">A</span><span className="text-accent-wine">I</span> Studio
        </span>
      </div>

      {/* Nav tabs — centered absolutely so logo/right-panel don't affect it */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5">
        {TABS.map(({ id, label, Icon, soon }) => (
          soon ? (
            <span
              key={id}
              className="flex items-center gap-1 px-2 py-1 lg:px-2.5 lg:py-1.5 rounded border text-[11px] lg:text-[12px] font-medium
                border-transparent text-text-muted cursor-not-allowed select-none opacity-60"
              title="Coming soon"
            >
              <Icon />
              <span className="hidden lg:inline">{label}</span>
              <span className="text-[9px] bg-bg-input/60 text-text-muted px-1 py-0.5 rounded hidden lg:inline">soon</span>
            </span>
          ) : (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`
                flex items-center gap-1.5 px-2 py-1 lg:px-2.5 lg:py-1.5 rounded border text-[11px] lg:text-[12px] font-medium
                transition-all duration-150 whitespace-nowrap cursor-pointer select-none
                ${activeTab === id
                  ? (['history','cars','getting-started'].includes(id)
                      ? 'bg-accent-teal/20 border-accent-teal/40 text-accent-teal'
                      : id === 'upscale'
                        ? 'bg-accent-wine/20 border-accent-wine/40 text-accent-wine'
                        : 'bg-accent/25 border-accent/30 text-accent')
                  : 'bg-transparent border-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }
              `}
            >
              <Icon />
              <span className="hidden lg:inline">{label}</span>
            </button>
          )
        ))}
      </nav>

      {/* Right side — Google AI Studio link + spending tracker + theme */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
        <a
          href="https://aistudio.google.com"
          target="_blank"
          rel="noreferrer"
          className="hidden xl:flex items-center gap-1.5 px-2.5 h-[30px] rounded border border-border-default bg-bg-input text-[12px] text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all duration-150 whitespace-nowrap"
          title="Open Google AI Studio dashboard"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Google AI Studio
        </a>
        <button
          onClick={onSpendingClick}
          disabled={historyLoading}
          className={`flex items-center gap-1.5 px-2.5 h-[30px] rounded border border-border-default bg-bg-input text-[12px] text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all duration-150 whitespace-nowrap ${
            historyLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title={historyLoading ? 'Loading history…' : 'View spending breakdown'}
        >
          {historyLoading ? (
            <>
              <div className="w-3 h-3 border-[1.5px] border-text-muted border-t-transparent rounded-full animate-spin" />
              <span className="text-text-muted">Loading…</span>
            </>
          ) : (
            <>
              <span className="text-text-muted">Spent {spendLabel}:</span>
              <span className="text-warning font-medium">~${totalSpend.toFixed(2)}</span>
            </>
          )}
        </button>
        <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
      </div>
    </header>
  );
}

export default TopBar;
