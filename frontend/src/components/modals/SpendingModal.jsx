import React, { useMemo, useState, useEffect } from 'react';
import { Modal } from '../common/Modal';

const FILTERS = [
  { id: 'today',   label: 'Today' },
  { id: 'week',    label: 'This Week' },
  { id: 'overall', label: 'Overall' },
];

function filterItems(items, filterId) {
  if (filterId === 'overall') return items;
  const now = Date.now();
  const cutoff = filterId === 'today'
    ? now - 24 * 60 * 60 * 1000
    : now - 7  * 24 * 60 * 60 * 1000;
  return items.filter((item) => (item.timestamp || 0) * 1000 >= cutoff);
}

function calcBreakdown(items) {
  const totals = { flash_1k: 0, flash_2k: 0, pro: 0, total: 0 };
  let count = 0;
  items.forEach((item) => {
    const cost = parseFloat(item.cost) || 0;
    totals.total += cost;
    count++;
    const model = (item.model || '').toLowerCase();
    if (model.includes('pro')) totals.pro += cost;
    else if (item.resolution_2k || (item.resolution || '').toLowerCase() === '2k') totals.flash_2k += cost;
    else totals.flash_1k += cost;
  });
  return { ...totals, count };
}

// ── Mini spend-over-time bar chart ────────────────────────────────────────────
function SpendChart({ items, filterId }) {
  const bars = useMemo(() => {
    if (!items.length) return [];
    const now = Date.now();

    if (filterId === 'today') {
      const buckets = Array.from({ length: 24 }, (_, i) => ({ label: `${i}`, value: 0 }));
      items.forEach((item) => {
        const age = now - (item.timestamp || 0) * 1000;
        const hour = 23 - Math.min(23, Math.floor(age / (60 * 60 * 1000)));
        buckets[hour].value += parseFloat(item.cost) || 0;
      });
      // Only label every 6 hours
      return buckets.map((b, i) => ({ ...b, label: i % 6 === 0 ? `${i}h` : '' }));
    }

    if (filterId === 'week') {
      const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const buckets = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
        return { label: DAY[d.getDay()], value: 0 };
      });
      items.forEach((item) => {
        const age = now - (item.timestamp || 0) * 1000;
        const dayIdx = 6 - Math.min(6, Math.floor(age / (24 * 60 * 60 * 1000)));
        buckets[dayIdx].value += parseFloat(item.cost) || 0;
      });
      return buckets;
    }

    // overall — monthly buckets (last 12 months)
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - (11 - i));
      return { label: d.toLocaleString('default', { month: 'short' }), value: 0 };
    });
    items.forEach((item) => {
      const d = new Date((item.timestamp || 0) * 1000);
      const monthsAgo = (new Date(now).getFullYear() - d.getFullYear()) * 12
        + new Date(now).getMonth() - d.getMonth();
      const idx = 11 - Math.min(11, monthsAgo);
      if (idx >= 0) buckets[idx].value += parseFloat(item.cost) || 0;
    });
    return buckets;
  }, [items, filterId]);

  const max = Math.max(...bars.map((b) => b.value), 0.001);
  if (!bars.some((b) => b.value > 0)) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Spend Over Time</div>
      <div className="flex items-end gap-px h-[52px]">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-end group relative"
            title={`$${bar.value.toFixed(4)}`}
          >
            <div
              className="w-full rounded-sm bg-warning/50 group-hover:bg-warning/80 transition-colors"
              style={{ height: `${Math.max(2, (bar.value / max) * 44)}px` }}
            />
          </div>
        ))}
      </div>
      {/* x-axis labels */}
      <div className="flex gap-px">
        {bars.map((bar, i) => (
          <div key={i} className="flex-1 text-center text-[8px] text-text-muted/50 leading-none truncate">
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function SpendingModal({ isOpen, onClose, historyItems = [], spendFilter = 'overall', onFilterChange }) {
  const [filter, setFilter] = useState(spendFilter);

  useEffect(() => { setFilter(spendFilter); }, [spendFilter]);

  const handleFilterChange = (f) => {
    setFilter(f);
    onFilterChange?.(f);
  };

  const filtered = useMemo(() => filterItems(historyItems, filter), [historyItems, filter]);
  const stats = useMemo(() => calcBreakdown(filtered), [filtered]);
  const filterLabel = FILTERS.find((f) => f.id === filter)?.label || '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Spending Breakdown" size="md">
      <div className="p-4 flex flex-col gap-4">

        {/* Time filter pills */}
        <div className="flex items-center gap-1 bg-bg-input rounded-lg p-0.5 self-start">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleFilterChange(id)}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
                filter === id
                  ? 'bg-bg-card text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Summary card */}
        <div className="p-4 bg-bg-card border border-border-default rounded-lg text-center">
          <div className="text-3xl font-bold text-warning mb-1">~${stats.total.toFixed(2)}</div>
          <div className="text-xs text-text-muted">
            {stats.count} generation{stats.count !== 1 ? 's' : ''}
            {filter !== 'overall' ? ` — ${filterLabel.toLowerCase()}` : ' total'}
          </div>
        </div>

        {/* Estimate disclaimer */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded border border-warning/30 bg-warning/5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning/80 flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-[11px] text-warning/80 leading-snug">
            <strong>Estimates only.</strong> Check the{' '}
            <a href="https://aistudio.google.com/app/spend" target="_blank" rel="noreferrer" className="underline hover:text-warning">
              Google AI Studio Usage Dashboard
            </a>{' '}for accurate charges.
          </p>
        </div>

        {/* Per-model breakdown */}
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">By Model</div>
          {[
            { label: 'Flash 1K', value: stats.flash_1k },
            { label: 'Flash 2K', value: stats.flash_2k },
            { label: 'Pro',      value: stats.pro },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-border-default">
              <span className="text-xs text-text-secondary">{label}</span>
              <span className="text-xs text-text-primary font-medium">~${value.toFixed(3)}</span>
            </div>
          ))}
        </div>

        {/* Spend-over-time chart */}
        <SpendChart items={filtered} filterId={filter} />

        {/* Filtered item list */}
        {filtered.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Generations</div>
            <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
              {filtered.slice(0, 30).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1 border-b border-border-default/40">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-text-secondary truncate">{item.display_name || item.car_folder}</div>
                    <div className="text-[9px] text-text-muted">
                      {item.timestamp ? new Date(item.timestamp * 1000).toLocaleString() : ''}
                    </div>
                  </div>
                  <div className="text-[10px] text-warning flex-shrink-0 ml-2">~${parseFloat(item.cost || 0).toFixed(3)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SpendingModal;
