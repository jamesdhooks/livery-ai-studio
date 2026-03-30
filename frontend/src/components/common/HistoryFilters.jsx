import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';

export function HistoryFilters({ 
  cars = [], 
  items = [],
  currentCar = null,
  filterCurrentCarOnly = false,
  filterBadges = [],
  onToggleCurrentCarOnly,
  onAddBadgeFilter,
  onRemoveBadgeFilter,
  // Select mode
  selectMode = false,
  selectedIds = new Set(),
  filteredItemsCount = 0,
  onToggleSelectMode,
  onToggleSelectAll,
  onDeleteSelected,
  trashing = false,
}) {
  const [showBadgeDropdown, setShowBadgeDropdown] = useState(false);
  const badgeDropdownRef = useRef(null);

  // Get available badges from items
  const availableBadges = new Set();
  items.forEach(item => {
    if (item.entry_type === 'spec' || item.mode === 'spec') availableBadges.add('spec');
    if (item.model?.toLowerCase().includes('pro')) availableBadges.add('pro');
    if (item.model?.toLowerCase().includes('flash')) availableBadges.add('flash');
    if (item.resolution_2k) availableBadges.add('2k');
    if (!item.resolution_2k) availableBadges.add('1k');
    if (item.mode === 'modify') availableBadges.add('modify');
    if (item.mode === 'iterate') availableBadges.add('iterate');
    if (item.mode === 'helmet') availableBadges.add('helmet');
    if (item.mode === 'suit') availableBadges.add('suit');
    if (item.upscaled) availableBadges.add('upscaled');
    if (item.resampled) availableBadges.add('resampled');
  });

  // Get current car object from folder string
  const currentCarObj = currentCar ? cars.find(c => c.folder === currentCar) : null;

  const badgeOptions = [
    { id: 'spec', label: 'Spec', color: 'bg-success/70' },
    { id: 'pro', label: 'Pro', color: 'bg-accent-wine/80' },
    { id: 'flash', label: 'Flash', color: 'bg-accent/60' },
    { id: '2k', label: '2K', color: 'bg-success/70' },
    { id: '1k', label: '1K', color: 'bg-text-muted/50' },
    { id: 'modify', label: 'Modify', color: 'bg-warning/70' },
    { id: 'iterate', label: 'Iterate', color: 'bg-warning/50' },
    { id: 'helmet', label: 'Helmet', color: 'bg-purple-600/70' },
    { id: 'suit', label: 'Suit', color: 'bg-purple-700/70' },
    { id: 'upscaled', label: 'Upscaled', color: 'bg-accent-wine/70' },
    { id: 'resampled', label: 'Resampled', color: 'bg-accent/70' },
  ].filter(b => availableBadges.has(b.id));

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e) => {
      if (badgeDropdownRef.current && !badgeDropdownRef.current.contains(e.target)) {
        setShowBadgeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);


  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-default bg-bg-panel flex-wrap">

      {selectMode ? (
        /* ── Select mode controls ── */
        <>
          {selectedIds.size > 0 ? (
            <>
              <button
                onClick={onToggleSelectAll}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                {selectedIds.size === filteredItemsCount ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-xs text-text-muted">{selectedIds.size} selected</span>
              <div className="flex-1" />
              <Button
                variant="danger"
                size="sm"
                onClick={onDeleteSelected}
                disabled={trashing}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Delete ({selectedIds.size})
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs text-text-muted flex-1">Click cards to select</span>
            </>
          )}
        </>
      ) : (
        /* ── Filter controls ── */
        <>
          {currentCarObj && (
            <button
              onClick={() => onToggleCurrentCarOnly()}
              className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-medium transition-all border ${
                filterCurrentCarOnly
                  ? 'bg-accent/15 text-accent border-accent/40'
                  : 'text-text-secondary border-border-default hover:text-text-primary hover:border-text-muted/40'
              }`}
              title={`Filter to only ${currentCarObj.display || currentCarObj.folder}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" />
                <path d="M12 1v6m0 6v6" />
                <path d="M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24" />
                <path d="M1 12h6m6 0h6" />
                <path d="M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24" />
              </svg>
              Current Car
            </button>
          )}

          {badgeOptions.length > 0 && (
            <div className="relative" ref={badgeDropdownRef}>
              <button
                onClick={() => setShowBadgeDropdown(!showBadgeDropdown)}
                className="px-2 py-1 rounded text-xs bg-bg-input border border-border-default text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors"
                title="Filter by badge"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showBadgeDropdown && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-bg-panel border border-border-default rounded shadow-lg overflow-hidden min-w-max">
                  <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
                    {badgeOptions.map(badge => (
                      <button
                        key={badge.id}
                        onClick={() => {
                          if (filterBadges.includes(badge.id)) {
                            onRemoveBadgeFilter(badge.id);
                          } else {
                            onAddBadgeFilter(badge.id);
                          }
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium text-left transition-colors flex items-center gap-2 ${
                          filterBadges.includes(badge.id)
                            ? `${badge.color} text-white`
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                        }`}
                      >
                        {filterBadges.includes(badge.id) && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2 6 5 9 10 3" />
                          </svg>
                        )}
                        <span>{badge.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active filter pills */}
          {filterCurrentCarOnly && currentCarObj && (
            <button
              onClick={() => onToggleCurrentCarOnly()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
            >
              {currentCarObj.display || currentCarObj.folder}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {filterBadges.map(badgeId => {
            const badge = badgeOptions.find(b => b.id === badgeId);
            return badge ? (
              <button
                key={badgeId}
                onClick={() => onRemoveBadgeFilter(badgeId)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white ${badge.color} hover:opacity-80 transition-opacity`}
              >
                {badge.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : null;
          })}
        </>
      )}

      {/* Select toggle — always on the right */}
      <div className="flex-1" />
      <button
        onClick={onToggleSelectMode}
        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all border ${
          selectMode
            ? 'bg-accent/15 text-accent border-accent/40'
            : 'text-text-secondary border-border-default hover:text-text-primary hover:border-text-muted/40'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {selectMode
            ? <polyline points="20 6 9 17 4 12" />
            : <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>}
        </svg>
        {selectMode ? 'Done' : 'Select'}
      </button>
    </div>
  );
}

export default HistoryFilters;
