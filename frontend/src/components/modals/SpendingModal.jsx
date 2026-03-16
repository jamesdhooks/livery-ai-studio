import React, { useMemo, useState, useEffect } from 'react';
import { Modal } from '../common/Modal';

const FILTERS = [
  { id: 'today',   label: 'Today' },
  { id: 'week',    label: 'This Week' },
  { id: 'overall', label: 'Overall' },
];

const STATUS_LABEL = { success: null, cancelled: 'Cancelled', failed: 'Failed', estimated: 'Pending' };
const STATUS_COLOR = {
  success:   'text-warning',
  cancelled: 'text-error/70',
  failed:    'text-error/70',
  estimated: 'text-text-muted',
};

/**
 * Normalize a spending-log entry into a consistent shape for display.
 * Both `spendingEntries` (from /api/spending) and legacy `historyItems`
 * (from /api/history) are accepted; spending entries take precedence when
 * the spending log is available.
 */
function normalizeEntry(e) {
  // Spending log shape: { id, ts, iso, model, resolution, cost, status, car, livery_id, estimated }
  if (e.iso || e.ts) {
    return {
      id:       e.id,
      ts:       e.ts,
      cost:     parseFloat(e.cost) || 0,
      model:    e.model || '',
      resolution: e.resolution || '1K',
      status:   e.status || 'success',
      car:      e.car || '',
      label:    e.car || '',
      estimated: !!e.estimated,
    };
  }
  // Legacy history shape: { id, timestamp, cost, model, resolution_2k, car_folder, display_name }
  return {
    id:       e.id,
    ts:       e.timestamp || 0,
    cost:     parseFloat(e.cost) || 0,
    model:    e.model || '',
    resolution: e.resolution_2k || (e.resolution || '').toLowerCase() === '2k' ? '2K' : '1K',
    status:   'success',
    car:      e.display_name || e.car_folder || '',
    label:    e.display_name || e.car_folder || '',
    estimated: false,
  };
}

function filterEntries(entries, filterId) {
  if (filterId === 'overall') return entries;
  const now = Date.now();
  const cutoff = filterId === 'today'
    ? now - 24 * 60 * 60 * 1000
    : now - 7  * 24 * 60 * 60 * 1000;
  return entries.filter((e) => e.ts * 1000 >= cutoff);
}

function calcBreakdown(entries) {
  const totals = { flash_1k: 0, flash_2k: 0, pro: 0, total: 0 };
  let count = 0;
  entries.forEach((e) => {
    totals.total += e.cost;
    count++;
    const model = e.model.toLowerCase();
    if (model.includes('pro')) totals.pro += e.cost;
    else if (e.resolution === '2K') totals.flash_2k += e.cost;
    else totals.flash_1k += e.cost;
  });
  return { ...totals, count };
}

// ── Mini spend-over-time bar chart ────────────────────────────────────────────
function SpendChart({ entries, filterId }) {
  const bars = useMemo(() => {
    if (!entries.length) return [];
    const now = Date.now();

    if (filterId === 'today') {
      const buckets = Array.from({ length: 24 }, (_, i) => ({ label: `${i}`, value: 0 }));
      entries.forEach((e) => {
        const age = now - e.ts * 1000;
        const hour = 23 - Math.min(23, Math.floor(age / (60 * 60 * 1000)));
        buckets[hour].value += e.cost;
      });
      return buckets.map((b, i) => ({ ...b, label: i % 6 === 0 ? `${i}h` : '' }));
    }

    if (filterId === 'week') {
      const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const buckets = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
        return { label: DAY[d.getDay()], value: 0 };
      });
      entries.forEach((e) => {
        const age = now - e.ts * 1000;
        const dayIdx = 6 - Math.min(6, Math.floor(age / (24 * 60 * 60 * 1000)));
        buckets[dayIdx].value += e.cost;
      });
      return buckets;
    }

    // overall — monthly buckets (last 12 months)
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - (11 - i));
      return { label: d.toLocaleString('default', { month: 'short' }), value: 0 };
    });
    entries.forEach((e) => {
      const d = new Date(e.ts * 1000);
      const monthsAgo = (new Date(now).getFullYear() - d.getFullYear()) * 12
        + new Date(now).getMonth() - d.getMonth();
      const idx = 11 - Math.min(11, monthsAgo);
      if (idx >= 0) buckets[idx].value += e.cost;
    });
    return buckets;
  }, [entries, filterId]);

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
/**
 * SpendingModal
 *
 * Accepts either:
 *   - `spendingEntries` — from useSpending (spending log, includes failed/cancelled)
 *   - `historyItems`    — legacy fallback from useHistory
 *
 * When `spendingEntries` is provided and non-empty, it takes precedence.
 */
export function SpendingModal({
  isOpen, onClose,
  spendingEntries = null,   // preferred: from useSpending
  historyItems = [],        // legacy fallback
  spendFilter = 'overall',
  onFilterChange,
}) {
  const [filter, setFilter] = useState(spendFilter);

  useEffect(() => { setFilter(spendFilter); }, [spendFilter]);

  const handleFilterChange = (f) => {
    setFilter(f);
    onFilterChange?.(f);
  };

  // Use spending log when available; fall back to history items
  const allEntries = useMemo(() => {
    const source = (spendingEntries && spendingEntries.length > 0)
      ? spendingEntries
      : historyItems;
    return source.map(normalizeEntry);
  }, [spendingEntries, historyItems]);

  const filtered = useMemo(() => filterEntries(allEntries, filter), [allEntries, filter]);
  const stats = useMemo(() => calcBreakdown(filtered), [filtered]);
  const filterLabel = FILTERS.find((f) => f.id === filter)?.label || '';
  const usingLog = spendingEntries && spendingEntries.length > 0;

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
            {usingLog && <span className="ml-1 text-success/60">(incl. cancelled/failed)</span>}
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
        <SpendChart entries={filtered} filterId={filter} />

        {/* Filtered item list */}
        {filtered.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Generations</div>
            <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
              {filtered.slice(0, 30).map((e) => {
                const statusLabel = STATUS_LABEL[e.status];
                const amountColor = STATUS_COLOR[e.status] || 'text-warning';
                return (
                  <div key={e.id} className="flex items-center justify-between py-1 border-b border-border-default/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-text-secondary truncate">{e.label || e.car || '—'}</span>
                        {statusLabel && (
                          <span className={`text-[8px] font-semibold uppercase tracking-wide ${amountColor}`}>{statusLabel}</span>
                        )}
                      </div>
                      <div className="text-[9px] text-text-muted">
                        {e.ts ? new Date(e.ts * 1000).toLocaleString() : ''}
                      </div>
                    </div>
                    <div className={`text-[10px] flex-shrink-0 ml-2 ${amountColor}`}>
                      {e.estimated ? '~' : ''}${e.cost.toFixed(3)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SpendingModal;

