import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Button } from '../common/Button';
import carsService from '../../services/CarsService';
import upscaleService from '../../services/UpscaleService';
import { formatTimestamp } from '../../utils/helpers';

// ── Small shared helpers ──────────────────────────────────────────────────────

function MetaField({ label, value, onChange, placeholder, mono = false, required = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] font-medium text-text-muted uppercase tracking-wide">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-2 py-1.5 text-[12px] bg-bg-input border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

function ImageDropField({ label, value, onChange, accept = 'image/*' }) {
  const ref = useRef(null);
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] font-medium text-text-muted uppercase tracking-wide">{label}</label>
      <div
        onClick={() => ref.current?.click()}
        className="flex items-center gap-2 px-2 py-1.5 bg-bg-input border border-dashed border-border-default rounded cursor-pointer hover:border-accent/40 transition-colors"
      >
        {value ? (
          <>
            <img
              src={URL.createObjectURL(value)}
              alt={label}
              className="w-10 h-7 object-cover rounded border border-border-default flex-shrink-0"
            />
            <span className="text-[11px] text-text-secondary truncate flex-1">{value.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="text-text-muted hover:text-error transition-colors flex-shrink-0 text-xs"
            >✕</button>
          </>
        ) : (
          <span className="text-[11px] text-text-muted">Click to upload {label.toLowerCase()}…</span>
        )}
      </div>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { onChange(e.target.files?.[0] || null); e.target.value = ''; }} />
    </div>
  );
}

// ── Zip metadata editor (shown when zips aren't in livery_map) ───────────────

/**
 * ZipMetaEditor — shown after peek when one or more zips are unmapped.
 * Lets the user fill in display_name + iracing_folder before the real import starts.
 */
function ZipMetaEditor({ peekResults, onConfirm, onCancel, importing }) {
  // State: one entry per zip peek result
  const [entries, setEntries] = useState(() =>
    peekResults.map((r) => ({
      tmp_path: r.tmp_path,
      zip_name: r.zip_name,
      psd_name: r.psd_name,
      mapped: r.mapped,
      // Pre-fill from livery_map if mapped, otherwise from suggestions
      display_name: r.mapped ? (r.entries[0]?.display_name || r.suggested_display) : r.suggested_display,
      iracing_folder: r.mapped ? (r.entries[0]?.iracing_folder || '') : '',
    }))
  );

  const updateEntry = (i, field, val) =>
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const allValid = entries.every((e) => e.display_name.trim() && e.iracing_folder.trim());
  const unmappedCount = entries.filter((e) => !e.mapped).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-default flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning flex-shrink-0">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <span className="text-sm font-semibold text-text-primary">Metadata Required</span>
          {unmappedCount > 0 && (
            <p className="text-[11px] text-text-muted mt-0.5">
              {unmappedCount} zip{unmappedCount > 1 ? 's' : ''} not found in livery_map.json — fill in the details below to continue.
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} className="ml-auto" disabled={importing}>Cancel</Button>
      </div>

      {/* Zip entries */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {entries.map((entry, i) => (
          <div
            key={entry.tmp_path}
            className={`rounded-lg border p-4 space-y-3 ${entry.mapped ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}
          >
            {/* Zip file header */}
            <div className="flex items-center gap-2">
              {entry.mapped ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-success flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
              <span className="text-[11px] font-mono text-text-muted truncate">{entry.zip_name}</span>
              {entry.psd_name && <span className="text-[10px] text-text-muted/60 truncate">→ {entry.psd_name}</span>}
              <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${entry.mapped ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                {entry.mapped ? 'Mapped' : 'Unmapped'}
              </span>
            </div>

            {/* Fields — always shown, pre-filled if mapped */}
            <div className="grid grid-cols-2 gap-3">
              <MetaField
                label="Display Name"
                value={entry.display_name}
                onChange={(v) => updateEntry(i, 'display_name', v)}
                placeholder="e.g. Porsche 911 GT3 Cup"
                required
              />
              <MetaField
                label="iRacing Folder"
                value={entry.iracing_folder}
                onChange={(v) => updateEntry(i, 'iracing_folder', v)}
                placeholder="e.g. porsche_911gt3cup_992"
                mono
                required
              />
            </div>
            {!entry.mapped && (
              <p className="text-[10px] text-text-muted">
                The iRacing folder name must match the folder inside your iRacing <code className="font-mono text-text-secondary">paint/</code> directory.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-6 py-3 border-t border-border-default flex-shrink-0">
        <Button
          variant="primary"
          size="sm"
          disabled={!allValid || importing}
          loading={importing}
          onClick={() => onConfirm(entries.map((e) => ({
            tmp_path: e.tmp_path,
            display_name: e.display_name.trim(),
            iracing_folder: e.iracing_folder.trim(),
          })))}
        >
          {importing ? 'Importing…' : `Import ${entries.length} ZIP${entries.length > 1 ? 's' : ''}`}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={importing}>Cancel</Button>
        {!allValid && (
          <span className="text-[11px] text-warning ml-auto">Fill in all required fields to continue</span>
        )}
      </div>
    </div>
  );
}

// ── Import Log Panel (shown in right panel during / after import) ─────────────

function ImportResultRow({ r }) {
  const [expanded, setExpanded] = useState(false);
  const isSkip = !r.ok && (r.error || '').toLowerCase().includes('already');
  const isOk   = r.ok;

  return (
    <div className={`border-b border-border-default/20 text-[11px] ${isOk ? 'text-text-primary' : isSkip ? 'text-text-muted' : 'text-error/90'}`}>
      {/* Main row — clickable if ok (has details) */}
      <div
        className={`flex items-start gap-2 px-4 py-1.5 ${isOk ? 'cursor-pointer hover:bg-bg-hover/50 select-none' : ''}`}
        onClick={() => isOk && setExpanded((v) => !v)}
      >
        <span className="flex-shrink-0 mt-0.5">
          {isOk
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-success"><polyline points="20 6 9 17 4 12"/></svg>
            : isSkip ? <span className="text-text-muted/50">⊘</span>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-error"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
        </span>
        <div className="min-w-0 flex-1">
          <span className="font-medium truncate block">{r.display_name || r.slug || r.zip || '—'}</span>
          {!isOk && r.error && (
            <span className={`text-[10px] block mt-0.5 ${isSkip ? 'text-text-muted/70' : 'text-error/70'}`}>{r.error}</span>
          )}
        </div>
        {r.zip && <span className="text-[10px] text-text-muted/50 flex-shrink-0 font-mono truncate max-w-[100px]">{r.zip}</span>}
        {isOk && (
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className={`flex-shrink-0 text-text-muted transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>

      {/* Expanded details */}
      {expanded && isOk && (
        <div className="px-4 pb-3 flex flex-col gap-2 bg-bg-card/40">
          {/* Metadata grid */}
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px] pt-2">
            {r.display_name && (
              <>
                <span className="text-text-muted font-medium">Display Name</span>
                <span className="text-text-secondary">{r.display_name}</span>
              </>
            )}
            {r.slug && (
              <>
                <span className="text-text-muted font-medium">Slug</span>
                <span className="font-mono text-text-secondary truncate">{r.slug}</span>
              </>
            )}
            {r.iracing_folder && (
              <>
                <span className="text-text-muted font-medium">iRacing Folder</span>
                <span className="font-mono text-text-secondary truncate">{r.iracing_folder}</span>
              </>
            )}
            {r.zip && (
              <>
                <span className="text-text-muted font-medium">Source ZIP</span>
                <span className="font-mono text-text-secondary truncate">{r.zip}</span>
              </>
            )}
            {r.psd_name && (
              <>
                <span className="text-text-muted font-medium">PSD File</span>
                <span className="font-mono text-text-secondary truncate">{r.psd_name}</span>
              </>
            )}
            {(r.width || r.height) && (
              <>
                <span className="text-text-muted font-medium">Dimensions</span>
                <span className="text-text-secondary">{r.width ?? '?'} × {r.height ?? '?'}</span>
              </>
            )}
            {r.wire_path && (
              <>
                <span className="text-text-muted font-medium">Wire</span>
                <span className="font-mono text-text-secondary truncate" title={r.wire_path}>{r.wire_path.split(/[\\/]/).pop()}</span>
              </>
            )}
            {r.diffuse_path && (
              <>
                <span className="text-text-muted font-medium">Diffuse</span>
                <span className="font-mono text-text-secondary truncate" title={r.diffuse_path}>{r.diffuse_path.split(/[\\/]/).pop()}</span>
              </>
            )}
            {r.trading_paints_url && (
              <>
                <span className="text-text-muted font-medium">Trading Paints</span>
                <a
                  href={r.trading_paints_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent truncate hover:underline"
                  title={r.trading_paints_url}
                >
                  {r.trading_paints_url.replace('https://', '')}
                </a>
              </>
            )}
            {r.template_download_url && (
              <>
                <span className="text-text-muted font-medium">Template ZIP</span>
                <a
                  href={r.template_download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent truncate hover:underline"
                  title={r.template_download_url}
                >
                  {r.template_download_url.split('/').pop()}
                </a>
              </>
            )}
          </div>
          {/* Image thumbnails */}
          {(r.wire_path || r.diffuse_path) && (
            <div className="flex gap-2">
              {r.wire_path && (
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] text-text-muted mb-1 uppercase tracking-wider">Wireframe</div>
                  <img
                    src={`/api/uploads/preview?path=${encodeURIComponent(r.wire_path)}`}
                    alt="Wireframe"
                    className="w-full rounded border border-border-default object-cover bg-bg-dark"
                    style={{ aspectRatio: '4/3' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
              {r.diffuse_path && (
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] text-text-muted mb-1 uppercase tracking-wider">Diffuse</div>
                  <img
                    src={`/api/uploads/preview?path=${encodeURIComponent(r.diffuse_path)}`}
                    alt="Diffuse"
                    className="w-full rounded border border-border-default object-cover bg-bg-dark"
                    style={{ aspectRatio: '4/3' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImportLogPanel({ running, error, log, results, onDismiss }) {
  const logEndRef = useRef(null);
  // null = show all; 'ok' | 'skip' | 'fail' = show only that group
  const [activeFilter, setActiveFilter] = useState(null);

  // Auto-scroll log to bottom as new entries arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  const okCount   = results.filter((r) => r.ok).length;
  const skipCount = results.filter((r) => !r.ok && (r.error || '').toLowerCase().includes('already')).length;
  const failCount = results.filter((r) => !r.ok && !(r.error || '').toLowerCase().includes('already')).length;

  const visibleResults = activeFilter
    ? results.filter((r) => {
        if (activeFilter === 'ok')   return r.ok;
        if (activeFilter === 'skip') return !r.ok && (r.error || '').toLowerCase().includes('already');
        if (activeFilter === 'fail') return !r.ok && !(r.error || '').toLowerCase().includes('already');
        return true;
      })
    : results;

  const toggleFilter = (key) => setActiveFilter((prev) => (prev === key ? null : key));

  // Progress: use results count relative to last [n/total] in log
  let totalZips = 0;
  let currentZip = 0;
  for (const line of log) {
    const m = line.match(/^\[(\d+)\/(\d+)\]/);
    if (m) { currentZip = parseInt(m[1], 10); totalZips = parseInt(m[2], 10); }
  }
  const progressPct = totalZips > 0 ? Math.round((currentZip / totalZips) * 100) : (running ? null : 100);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-default flex-shrink-0">
        {running ? (
          <>
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm font-semibold text-text-primary">Importing Cars…</span>
            {totalZips > 0 && (
              <span className="text-xs text-text-muted ml-auto">{currentZip} / {totalZips} zips</span>
            )}
          </>
        ) : (
          <>
            {error ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-error flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
            )}
            <span className="text-sm font-semibold text-text-primary">
              {error ? 'Import Failed' : 'Import Complete'}
            </span>
            <Button variant="ghost" size="sm" onClick={onDismiss} className="ml-auto">
              Dismiss
            </Button>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-6 pt-3 flex-shrink-0">
        <div className="h-1.5 w-full bg-bg-input rounded-full overflow-hidden">
          {progressPct !== null ? (
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          ) : (
            <div className="h-full bg-accent/60 rounded-full animate-pulse" style={{ width: '100%' }} />
          )}
        </div>
      </div>

      {/* Summary badges — click to filter results */}
      {results.length > 0 && (
        <div className="flex items-center gap-3 px-6 py-3 flex-shrink-0">
          {okCount > 0 && (
            <button
              onClick={() => toggleFilter('ok')}
              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                activeFilter === 'ok'
                  ? 'text-success bg-success/20 border-success/50 ring-1 ring-success/30'
                  : 'text-success bg-success/10 border-success/20 hover:bg-success/20'
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              {okCount} imported
            </button>
          )}
          {skipCount > 0 && (
            <button
              onClick={() => toggleFilter('skip')}
              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                activeFilter === 'skip'
                  ? 'text-text-secondary bg-bg-hover border-border-default ring-1 ring-border-default'
                  : 'text-text-muted bg-bg-input border-border-default hover:bg-bg-hover'
              }`}
            >
              ⊘ {skipCount} skipped
            </button>
          )}
          {failCount > 0 && (
            <button
              onClick={() => toggleFilter('fail')}
              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                activeFilter === 'fail'
                  ? 'text-error bg-error/20 border-error/50 ring-1 ring-error/30'
                  : 'text-error bg-error/10 border-error/20 hover:bg-error/20'
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              {failCount} failed
            </button>
          )}
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="ml-auto text-[10px] text-text-muted hover:text-text-secondary transition-colors"
            >
              show all
            </button>
          )}
        </div>
      )}

      {/* Split view: results list + raw log */}
      <div className="flex flex-1 overflow-hidden gap-0 min-h-0">
        {/* Results list */}
        <div className="flex-1 overflow-y-auto border-r border-border-default min-w-0">
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border-default/50 sticky top-0 bg-bg-dark z-10">
            Results
          </div>
          {results.length === 0 && running && (
            <div className="p-4 text-xs text-text-muted italic">Waiting for results…</div>
          )}
          {visibleResults.length === 0 && results.length > 0 && (
            <div className="p-4 text-xs text-text-muted italic">No results match this filter.</div>
          )}
          {visibleResults.map((r, i) => (
            <ImportResultRow key={i} r={r} />
          ))}
        </div>

        {/* Raw log */}
        <div className="w-[280px] flex-shrink-0 flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border-default/50 sticky top-0 bg-bg-dark z-10">
            Log
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-[10px] font-mono text-text-secondary space-y-0.5">
              {log.map((line, i) => {
                const isHeader = /^\[\d+\/\d+\]/.test(line);
                const isOk     = line.includes('✓') || line.includes('OK');
                const isSkip   = line.includes('⊘');
                const isErr    = line.includes('Error') || line.includes('error') || line.includes('✗');
                return (
                  <div
                    key={i}
                    className={`leading-snug ${isHeader ? 'text-accent font-semibold mt-1' : isOk ? 'text-success/80' : isSkip ? 'text-text-muted/60' : isErr ? 'text-error/80' : 'text-text-secondary/70'}`}
                  >
                    {line}
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-6 py-3 border-t border-error/20 bg-error/5 text-xs text-error flex-shrink-0">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}
    </div>
  );
}

// ── Main CarsTab ──────────────────────────────────────────────────────────────

export function CarsTab({ cars = [], selectedFolder, onSelectCar, getWireframeUrl, historyItems = [], onNavigateToHistory, starredCars = [], onStarredChange }) {
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(selectedFolder || null);

  // Import flow state
  const [importRunning, setImportRunning] = useState(false);
  const [importLog, setImportLog] = useState([]);
  const [importResults, setImportResults] = useState([]);
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState(null);

  // Peek/meta-editor state (zip-peek flow)
  const [peekResults, setPeekResults] = useState(null);   // null = no peek in progress
  const [peekImporting, setPeekImporting] = useState(false);

  // Add-car form state
  const [showAddCar, setShowAddCar] = useState(false);
  const [addFolder, setAddFolder] = useState('');
  const [addDisplay, setAddDisplay] = useState('');
  const [addWireFile, setAddWireFile] = useState(null);
  const [addBaseFile, setAddBaseFile] = useState(null);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState(null);

  const starred = useMemo(() => new Set(starredCars), [starredCars]);
  const importPollRef = useRef(null);
  const zipInputRef = useRef(null);

  const selectedCar = useMemo(() => cars.find((c) => c.folder === selectedSlug) ?? null, [cars, selectedSlug]);

  // Sort: starred first, then alphabetical
  const filtered = useMemo(() => {
    let list = cars;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) => c.display.toLowerCase().includes(q) || c.folder.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aStarred = starred.has(a.folder);
      const bStarred = starred.has(b.folder);
      if (aStarred !== bStarred) return aStarred ? -1 : 1;
      return a.display.localeCompare(b.display);
    });
  }, [cars, query, starred]);

  // Per-car stats from history
  const carStats = useMemo(() => {
    const stats = {};
    for (const item of historyItems) {
      const folder = item.car_folder;
      if (!folder) continue;
      if (!stats[folder]) stats[folder] = { count: 0, spend: 0 };
      stats[folder].count += 1;
      stats[folder].spend += parseFloat(item.cost || 0);
    }
    return stats;
  }, [historyItems]);

  // History for selected car
  const selectedCarHistory = useMemo(() => {
    if (!selectedSlug) return [];
    return historyItems.filter((item) => item.car_folder === selectedSlug).slice(0, 12);
  }, [historyItems, selectedSlug]);

  const toggleStar = useCallback((folder) => {
    const next = new Set(starred);
    if (next.has(folder)) next.delete(folder);
    else next.add(folder);
    onStarredChange?.([...next]);
  }, [starred, onStarredChange]);

  const pollImportStatus = useCallback(() => {
    if (importPollRef.current) clearInterval(importPollRef.current);
    importPollRef.current = setInterval(async () => {
      try {
        const status = await carsService.getImportStatus();
        setImportLog(status.log || []);
        setImportResults(status.results || []);
        if (status.done || !status.running) {
          setImportRunning(false);
          setImportDone(true);
          setImportError(status.error || null);
          clearInterval(importPollRef.current);
          importPollRef.current = null;
        }
      } catch {
        // keep polling
      }
    }, 1000);
  }, []);

  const handleImportFolder = async () => {
    try {
      const data = await upscaleService.pickFolder();
      if (!data.path) return;
      setImportRunning(true);
      setImportDone(false);
      setImportError(null);
      setImportLog([]);
      setImportResults([]);
      await carsService.importFromFolder(data.path);
      pollImportStatus();
    } catch (e) {
      setImportError(e.message);
    }
  };

  // New ZIP flow: peek first, show meta-editor for unmapped zips, then import
  const handleImportZip = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    try {
      // Peek all selected zips
      const peekData = await carsService.peekZips(files);
      const results = peekData.results || [];

      // If all are mapped, skip the editor and go straight to import
      const anyUnmapped = results.some((r) => !r.mapped);
      if (!anyUnmapped && results.length > 0) {
        // Directly import with prefilled metadata
        setImportRunning(true);
        setImportDone(false);
        setImportError(null);
        setImportLog([]);
        setImportResults([]);
        await carsService.importWithMeta(
          results.map((r) => ({
            tmp_path: r.tmp_path,
            display_name: r.entries[0]?.display_name || r.suggested_display,
            iracing_folder: r.entries[0]?.iracing_folder || '',
          }))
        );
        pollImportStatus();
      } else {
        // Show meta editor
        setPeekResults(results);
      }
    } catch (e) {
      setImportError(e.message);
    }
  };

  const handleMetaConfirm = async (entries) => {
    setPeekImporting(true);
    try {
      setImportRunning(true);
      setImportDone(false);
      setImportError(null);
      setImportLog([]);
      setImportResults([]);
      setPeekResults(null);
      await carsService.importWithMeta(entries);
      pollImportStatus();
    } catch (e) {
      setImportError(e.message);
      setImportRunning(false);
    } finally {
      setPeekImporting(false);
    }
  };

  const handleAbortImport = async () => {
    try { await carsService.abortImport(); } catch { /* ignore */ }
  };

  const resetAddForm = () => {
    setShowAddCar(false);
    setAddFolder('');
    setAddDisplay('');
    setAddWireFile(null);
    setAddBaseFile(null);
    setAddError(null);
  };

  const handleAddCustomCar = async () => {
    const folder = addFolder.trim();
    if (!folder) return;
    setAddError(null);
    setAddSaving(true);
    try {
      const result = await carsService.addCustomCarFull({
        folder,
        display: addDisplay.trim() || folder,
        wireFile: addWireFile,
        baseFile: addBaseFile,
      });
      if (result.error) { setAddError(result.error); return; }
      resetAddForm();
      window.location.reload();
    } catch (e) {
      setAddError(e.message || 'Failed to add car');
    } finally {
      setAddSaving(false);
    }
  };

  useEffect(() => {
    return () => { if (importPollRef.current) clearInterval(importPollRef.current); };
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — car list */}
      <div className="w-[420px] min-w-[340px] flex-shrink-0 flex flex-col border-r border-border-default">
        {/* Search + import bar */}
        <div className="p-3 flex flex-col gap-2 border-b border-border-default flex-shrink-0">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${cars.length} cars…`}
            className="w-full px-3 py-2 text-xs bg-bg-input border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="secondary" size="sm" onClick={handleImportFolder} disabled={importRunning}>
              Import Folder
            </Button>
            <Button variant="secondary" size="sm" onClick={() => zipInputRef.current?.click()} disabled={importRunning || !!peekResults}>
              Import ZIP
            </Button>
            <input ref={zipInputRef} type="file" accept=".zip" multiple className="hidden" onChange={handleImportZip} />
            {importRunning && (
              <Button variant="danger" size="sm" onClick={handleAbortImport}>
                Abort
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowAddCar((v) => !v)}>
              {showAddCar ? 'Cancel' : '+ Add Car'}
            </Button>
          </div>

          {/* Expanded Add Car form */}
          {showAddCar && (
            <div className="flex flex-col gap-2 p-3 bg-bg-card rounded border border-border-default">
              <MetaField
                label="iRacing Folder"
                value={addFolder}
                onChange={setAddFolder}
                placeholder="e.g. porsche_911gt3cup_992"
                mono
                required
              />
              <MetaField
                label="Display Name"
                value={addDisplay}
                onChange={setAddDisplay}
                placeholder="e.g. Porsche 911 GT3 Cup (optional)"
              />
              <ImageDropField label="Wireframe" value={addWireFile} onChange={setAddWireFile} />
              <ImageDropField label="Base Texture" value={addBaseFile} onChange={setAddBaseFile} />
              <div className="flex items-center gap-1.5 pt-1">
                <Button variant="primary" size="sm" onClick={handleAddCustomCar} disabled={!addFolder.trim() || addSaving} loading={addSaving}>
                  Save Car
                </Button>
                <Button variant="ghost" size="sm" onClick={resetAddForm} disabled={addSaving}>
                  Cancel
                </Button>
                {addError && <span className="text-[11px] text-error">{addError}</span>}
              </div>
              <p className="text-[10px] text-text-muted">
                The iRacing folder must match the folder name in your iRacing <code className="font-mono">paint/</code> directory. Wireframe and base texture are optional.
              </p>
            </div>
          )}
        </div>

        {/* Car list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-xs text-text-muted">No cars match</div>
          )}
          {filtered.map((car) => (
            <div
              key={car.folder}
              onClick={() => {
                setSelectedSlug(car.folder);
                onSelectCar?.(car.folder);
              }}
              className={`
                flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-border-default/30
                ${car.folder === selectedSlug
                  ? 'bg-accent-teal/20 text-accent-teal'
                  : car.folder === selectedFolder
                    ? 'bg-accent-teal/10 text-accent-teal/80'
                    : 'hover:bg-bg-hover text-text-primary'
                }
              `}
            >
              {/* Star toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleStar(car.folder); }}
                className={`flex-shrink-0 text-[14px] transition-colors cursor-pointer ${starred.has(car.folder) ? 'text-warning' : 'text-text-muted/30 hover:text-warning/60'}`}
                title={starred.has(car.folder) ? 'Remove from favourites' : 'Add to favourites'}
              >
                {starred.has(car.folder) ? '★' : '☆'}
              </button>
              {/* Thumbnail */}
              <div className="w-12 h-8 flex-shrink-0 bg-bg-dark rounded overflow-hidden border border-border-default">
                <img
                  src={getWireframeUrl?.(car.slug || car.folder)}
                  alt={car.display}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{car.display}</div>
                <div className="text-[10px] text-text-muted flex items-center gap-2">
                  <span>{car.folder}</span>
                  {carStats[car.folder] && (
                    <>
                      <span className="text-border-default">·</span>
                      <span>{carStats[car.folder].count} liveries</span>
                      <span className="text-warning">${carStats[car.folder].spend.toFixed(2)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {car.folder === selectedFolder && (
                  <span className="text-[10px] bg-accent-teal/20 text-accent-teal px-1.5 py-0.5 rounded font-medium">Active</span>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Right panel — meta editor OR import log OR selected car detail */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bg-dark">
        {peekResults ? (
          <ZipMetaEditor
            peekResults={peekResults}
            onConfirm={handleMetaConfirm}
            onCancel={() => setPeekResults(null)}
            importing={peekImporting}
          />
        ) : (importRunning || importDone) ? (
          <ImportLogPanel
            running={importRunning}
            done={importDone}
            error={importError}
            log={importLog}
            results={importResults}
            onDismiss={() => { setImportDone(false); setImportRunning(false); setImportLog([]); setImportResults([]); setImportError(null); }}
          />
        ) : selectedCar ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto space-y-6">
              {/* Car name */}
              <div>
                <h2 className="text-lg font-bold text-text-primary">{selectedCar.display}</h2>
                <p className="text-xs text-text-muted font-mono mt-0.5">{selectedCar.folder}</p>
              </div>

              {/* Wireframe preview */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Wireframe</div>
                <img
                  src={getWireframeUrl?.(selectedCar.slug || selectedCar.folder)}
                  alt="Wireframe"
                  className="w-full rounded-lg border border-border-default shadow-lg"
                />
              </div>

              {/* Diffuse preview */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Diffuse (Base Texture)</div>
                <img
                  src={`/api/library/image/${selectedCar.slug || selectedCar.folder}/diffuse.jpg`}
                  alt="Diffuse"
                  className="w-full rounded-lg border border-border-default shadow-lg"
                />
              </div>

              {/* Links */}
              {(selectedCar.trading_paints_url || selectedCar.template_download_url) && (
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Links</div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedCar.trading_paints_url && (
                      <a
                        href={selectedCar.trading_paints_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-card border border-border-default rounded text-xs text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        View on Trading Paints
                      </a>
                    )}
                    {selectedCar.template_download_url && (
                      <a
                        href={selectedCar.template_download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-card border border-border-default rounded text-xs text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download Template
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Select button */}
              <Button
                variant={selectedCar.folder === selectedFolder ? 'success' : 'primary'}
                size="md"
                onClick={() => onSelectCar?.(selectedCar.folder)}
                className="w-full"
              >
                {selectedCar.folder === selectedFolder ? '✓ Active Car' : 'Select This Car'}
              </Button>

              {/* Mini-history for this car */}
              {selectedCarHistory.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                    Livery History ({carStats[selectedSlug]?.count || selectedCarHistory.length})
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {selectedCarHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onNavigateToHistory?.(item.id)}
                        className="bg-bg-card border border-border-default rounded overflow-hidden cursor-pointer hover:border-accent/40 transition-colors group"
                        title={item.prompt ? item.prompt.slice(0, 80) : formatTimestamp(item.timestamp * 1000)}
                      >
                        <div className="aspect-[4/3] bg-bg-dark overflow-hidden">
                          {item.preview_url ? (
                            <img
                              src={item.preview_url}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-muted opacity-30">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                            </div>
                          )}
                        </div>
                        <div className="px-1 py-0.5 text-[9px] text-text-muted truncate">
                          {item.timestamp ? formatTimestamp(item.timestamp * 1000) : '—'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted opacity-20 mx-auto mb-3">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
              </svg>
              <p className="text-sm text-text-muted">Select a car to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CarsTab;
