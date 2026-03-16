import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ImageActionTray } from '../common/ImageActionTray';
import { LiveryDetailPanel } from '../common/LiveryDetailPanel';
import { formatTimestamp } from '../../utils/helpers';
import upscaleService from '../../services/UpscaleService';
import { getFilename } from '../../utils/helpers';
import { useHistoryContext } from '../../context/HistoryContext';
import { useCarsContext } from '../../context/CarsContext';
import { useUpscaleContext } from '../../context/UpscaleContext';
import { useSpecularContext } from '../../context/SpecularContext';
import { useConfigContext } from '../../context/ConfigContext';
import { useToastContext } from '../../context/ToastContext';


export function HistoryTab({
  onIterateFrom,
  onRegenerateFrom,
  onNavigateToSpecular,
  onSwitchTab,
}) {
  // ── Contexts ─────────────────────────────────────────────────────────────
  const { items, loading, loadHistory, deleteItem: onDelete, updateItemCar: onUpdateItemCar } = useHistoryContext();
  const { cars, setBaseOverride } = useCarsContext();
  const { deploy: deployTexture, deploying } = useUpscaleContext();
  const { deploySpec } = useSpecularContext();
  const { config } = useConfigContext();
  const { toast: onNotify } = useToastContext();

  const onLoad = loadHistory;
  const onDeploy = useCallback((path, carFolder, _cid) => {
    deployTexture(path, carFolder, config?.customer_id);
  }, [deployTexture, config?.customer_id]);
  const onDeploySpec = useCallback((path, carFolder, _cid) => {
    deploySpec(path, carFolder, config?.customer_id);
  }, [deploySpec, config?.customer_id]);
  const onLoadAsBase = useCallback((path) => {
    setBaseOverride(path);
  }, [setBaseOverride]);
  const [selectedId, setSelectedId] = useState(null);
  const [fullResUrl, setFullResUrl] = useState(null);
  const [loadingFullRes, setLoadingFullRes] = useState(false);
  const [editingCar, setEditingCar] = useState(false);
  const [carSearch, setCarSearch] = useState('');
  const carDropdownRef = useRef(null);

  useEffect(() => {
    onLoad?.();
  }, []);

  // Auto-select first item when items load, or pick up a focus request
  useEffect(() => {
    if (!items?.length) return;
    try {
      const focusId = sessionStorage.getItem('history-focus-id');
      if (focusId) {
        sessionStorage.removeItem('history-focus-id');
        const target = items.find((i) => i.id === focusId);
        if (target) { setSelectedId(focusId); return; }
      }
    } catch { /* ignore */ }
    if (!selectedId) setSelectedId(items[0].id);
  }, [items]);

  const selectedItem = items?.find((i) => i.id === selectedId) || null;

  // Load full-res TGA preview when selected item changes
  const loadFullRes = useCallback(async (item) => {
    if (!item?.livery_path) { setFullResUrl(null); return; }
    setLoadingFullRes(true);
    try {
      const data = await upscaleService.getImageData(item.livery_path);
      if (data.base64) {
        setFullResUrl(`data:image/png;base64,${data.base64}`);
      } else {
        setFullResUrl(item.preview_url || null);
      }
    } catch {
      setFullResUrl(item.preview_url || null);
    } finally {
      setLoadingFullRes(false);
    }
  }, []);

  useEffect(() => {
    if (selectedItem) {
      loadFullRes(selectedItem);
    } else {
      setFullResUrl(null);
    }
  }, [selectedId, selectedItem?.livery_path]);

  // Close car edit dropdown on click outside
  useEffect(() => {
    if (!editingCar) return;
    const handler = (e) => {
      if (carDropdownRef.current && !carDropdownRef.current.contains(e.target)) {
        setEditingCar(false);
        setCarSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingCar]);

  // Reset edit state when selection changes
  useEffect(() => { setEditingCar(false); setCarSearch(''); }, [selectedId]);

  const handleCarSelect = useCallback(async (carFolder, carDisplay) => {
    if (!selectedItem) return;
    const ok = await onUpdateItemCar?.(selectedItem.id, carFolder, carDisplay);
    if (ok) {
      setEditingCar(false);
      setCarSearch('');
    }
  }, [selectedItem, onUpdateItemCar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted opacity-20">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <p className="text-sm text-text-muted">No generations yet</p>
        <p className="text-xs text-text-muted">Generate a livery to see it here</p>
      </div>
    );
  }

  const isProModel = selectedItem?.model?.toLowerCase().includes('pro');
  const isSpecItem = selectedItem?.entry_type === 'spec' || selectedItem?.mode === 'spec';

  const meta = selectedItem
    ? [
        { label: 'Car', value: selectedItem.display_name || selectedItem.car_folder, onEdit: onUpdateItemCar ? () => setEditingCar(true) : undefined },
        { label: 'Type', value: isSpecItem ? 'Spec Map' : 'Livery', className: isSpecItem ? 'text-success' : 'text-text-primary' },
        { label: 'Model', value: selectedItem.model || '—', className: isProModel ? 'text-accent-wine' : 'text-accent' },
        { label: 'Resolution', value: selectedItem.resolution_2k ? '2K (2048×2048)' : '1K (1024×1024)', className: isProModel ? 'text-accent-wine/80' : 'text-accent/80' },
        { label: 'Cost', value: selectedItem.cost != null ? `$${parseFloat(selectedItem.cost).toFixed(4)}` : '—', className: 'text-warning' },
        { label: 'Generated', value: selectedItem.timestamp ? formatTimestamp(selectedItem.timestamp * 1000) : '—' },
        { label: 'File', value: selectedItem.livery_path || '—' },
      ]
    : [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — card grid */}
      <div className="w-[420px] min-w-[340px] flex-shrink-0 border-r border-border-default overflow-y-auto">
        <div className="p-3 grid grid-cols-2 gap-2">
          {items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onClick={() => setSelectedId(item.id)}
            />
          ))}
        </div>
      </div>

      {/* Right panel — detail */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bg-dark relative">
        {selectedItem ? (
          <>
            <LiveryDetailPanel
              imageUrl={fullResUrl}
              previewUrl={selectedItem.preview_url}
              imagePath={selectedItem.livery_path}
              downloadName={`${selectedItem.display_name || selectedItem.car_folder}${isSpecItem ? '_spec' : ''}.png`}
              prompt={selectedItem.prompt}
              context={selectedItem.context}
              conversationLog={selectedItem.conversation_log}
              meta={meta}
              onDeploy={isSpecItem
                ? (onDeploySpec ? () => onDeploySpec?.(selectedItem.livery_path, selectedItem.car_folder, null) : undefined)
                : () => onDeploy?.(selectedItem.livery_path, selectedItem.car_folder, null)
              }
              deployLabel={isSpecItem ? 'Deploy Spec to iRacing' : 'Deploy to iRacing'}
              deploying={deploying}
              onLoadAsBase={!isSpecItem && selectedItem.livery_path ? () => {
                onLoadAsBase?.(selectedItem.livery_path);
                onSwitchTab?.('generate');
              } : undefined}
              onIterate={!isSpecItem ? () => onIterateFrom?.(selectedItem) : undefined}
              onRegenerate={!isSpecItem && (selectedItem?.prompt || selectedItem?.context) ? () => onRegenerateFrom?.(selectedItem) : undefined}
              onMakeSpec={!isSpecItem && selectedItem.livery_path ? () => {
                onNavigateToSpecular?.(selectedItem.livery_path, selectedItem.car_folder);
              } : undefined}
              onDelete={() => { onDelete?.(selectedItem.id); setSelectedId(null); }}
              onNotify={onNotify}
              onSwitchTab={onSwitchTab}
            />
            {/* ── Inline car edit dropdown ───────────────────────────── */}
            {editingCar && (
              <div ref={carDropdownRef} className="absolute bottom-14 right-4 z-50 w-72 bg-bg-panel border border-border-default rounded-lg shadow-xl overflow-hidden">
                <div className="p-2 border-b border-border-default">
                  <input
                    type="text"
                    value={carSearch}
                    onChange={(e) => setCarSearch(e.target.value)}
                    placeholder="Search cars…"
                    autoFocus
                    className="w-full bg-bg-input border border-border-default rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {cars
                    .filter(c => !carSearch || c.display?.toLowerCase().includes(carSearch.toLowerCase()) || c.folder?.toLowerCase().includes(carSearch.toLowerCase()))
                    .map(c => (
                      <button
                        key={c.folder}
                        onClick={() => handleCarSelect(c.folder, c.display || c.folder)}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                          c.folder === selectedItem?.car_folder
                            ? 'bg-accent/15 text-accent font-medium'
                            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                        }`}
                      >
                        {c.display || c.folder}
                      </button>
                    ))
                  }
                  {cars.filter(c => !carSearch || c.display?.toLowerCase().includes(carSearch.toLowerCase()) || c.folder?.toLowerCase().includes(carSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-text-muted">No cars match "{carSearch}"</p>
                  )}
                </div>
              </div>
            )}
            {/* ── Spec associations panel ────────────────────────────── */}
            {!isSpecItem && selectedItem.spec_maps?.length > 0 && (
              <div className="flex-shrink-0 border-t border-border-default bg-bg-panel px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  Linked Spec Maps ({selectedItem.spec_maps.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.spec_maps.map((specPath, idx) => {
                    const specItem = items.find((i) => i.livery_path === specPath);
                    const label = specItem
                      ? formatTimestamp((specItem.timestamp || 0) * 1000)
                      : getFilename(specPath);
                    return (
                      <button
                        key={specPath}
                        title={specPath}
                        onClick={() => specItem && setSelectedId(specItem.id)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded border border-success/40 bg-success/5 text-[11px] text-success hover:bg-success/10 transition-colors"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
                          <path d="M12 3L9 9H3l4.5 4.5-1.5 6L12 16.5 18 19.5l-1.5-6L21 9h-6z" />
                        </svg>
                        Spec {idx + 1}
                        {label && <span className="text-success/60">— {label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* ── Iterations panel ───────────────────────────────────── */}
            {!isSpecItem && selectedItem.iterations?.length > 0 && (
              <div className="flex-shrink-0 border-t border-border-default bg-bg-panel px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  Iterations ({selectedItem.iterations.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.iterations.map((iterPath, idx) => {
                    const iterItem = items.find((i) => i.livery_path === iterPath);
                    const label = iterItem
                      ? formatTimestamp((iterItem.timestamp || 0) * 1000)
                      : getFilename(iterPath);
                    return (
                      <button
                        key={iterPath}
                        title={iterPath}
                        onClick={() => iterItem && setSelectedId(iterItem.id)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded border border-warning/40 bg-warning/5 text-[11px] text-warning hover:bg-warning/10 transition-colors"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
                          <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                        </svg>
                        Iteration {idx + 1}
                        {label && <span className="text-warning/60">— {label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* ── Source livery link (for spec items) ───────────────── */}
            {isSpecItem && selectedItem.source_livery_path && (
              <div className="flex-shrink-0 border-t border-border-default bg-bg-panel px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                  Source Livery
                </div>
                {(() => {
                  const srcItem = items.find(
                    (i) => i.livery_path === selectedItem.source_livery_path
                  );
                  return (
                    <button
                      title={selectedItem.source_livery_path}
                      onClick={() => srcItem && setSelectedId(srcItem.id)}
                      disabled={!srcItem}
                      className="flex items-center gap-1.5 px-2 py-1 rounded border border-accent/40 bg-accent/5 text-[11px] text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      </svg>
                      {srcItem
                        ? `${srcItem.display_name || srcItem.car_folder} — ${formatTimestamp((srcItem.timestamp || 0) * 1000)}`
                        : getFilename(selectedItem.source_livery_path)}
                    </button>
                  );
                })()}
              </div>
            )}
            {/* ── Source livery link (for modify/iterate items) ──────── */}
            {!isSpecItem && selectedItem.source_livery_path && (
              <div className="flex-shrink-0 border-t border-border-default bg-bg-panel px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                  Based On
                </div>
                {(() => {
                  const srcItem = items.find(
                    (i) => i.livery_path === selectedItem.source_livery_path
                  );
                  return (
                    <button
                      title={selectedItem.source_livery_path}
                      onClick={() => srcItem && setSelectedId(srcItem.id)}
                      disabled={!srcItem}
                      className="flex items-center gap-1.5 px-2 py-1 rounded border border-warning/40 bg-warning/5 text-[11px] text-warning hover:bg-warning/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
                        <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                      </svg>
                      {srcItem
                        ? `${srcItem.display_name || srcItem.car_folder} — ${formatTimestamp((srcItem.timestamp || 0) * 1000)}`
                        : getFilename(selectedItem.source_livery_path)}
                    </button>
                  );
                })()}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-text-muted">Select an item to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryCard({ item, selected, onClick }) {
  const modelLabel = item.model?.includes('pro') ? 'Pro' : item.model?.includes('flash') ? 'Flash' : null;
  const modeLabel = item.mode === 'iterate' ? 'Iterate' : item.mode === 'modify' ? 'Modify' : null;
  const isSpecItem = item.entry_type === 'spec' || item.mode === 'spec';
  const resLabel = item.resolution_2k ? '2K' : '1K';

  return (
    <div
      onClick={onClick}
      className={`bg-bg-card border rounded-lg overflow-hidden cursor-pointer transition-all group relative flex flex-col ${
        selected
          ? 'border-accent-teal ring-1 ring-accent-teal/30'
          : 'border-border-default hover:border-accent-teal/30'
      }`}
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-bg-dark overflow-hidden relative">
        {item.preview_url ? (
          <img
            src={item.preview_url}
            alt={item.display_name || item.car_folder}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-30"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
          </div>
        )}
        {/* Badges */}
        <div className="absolute top-1 right-1 flex gap-0.5">
          {isSpecItem && (
            <span className="px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white bg-success/70">
              Spec
            </span>
          )}
          {!isSpecItem && modelLabel && (
            <span className={`px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white ${modelLabel === 'Pro' ? 'bg-accent-wine/80' : 'bg-accent/60'}`}>
              {modelLabel}
            </span>
          )}
          {!isSpecItem && resLabel && (
            <span className={`px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white ${resLabel === '2K' ? 'bg-success/70' : 'bg-text-muted/50'}`}>
              {resLabel}
            </span>
          )}
          {!isSpecItem && modeLabel && (
            <span className="px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white bg-warning/70">
              {modeLabel}
            </span>
          )}
          {item.spec_maps?.length > 0 && (
            <span className="px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white bg-success/50" title={`${item.spec_maps.length} spec map(s) linked`}>
              ◆{item.spec_maps.length}
            </span>
          )}
          {item.iterations?.length > 0 && (
            <span className="px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white bg-warning/50" title={`${item.iterations.length} iteration(s)`}>
              ↻{item.iterations.length}
            </span>
          )}
          {item.upscaled && (
            <span className="px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white bg-accent-wine/70">
              Upscaled
            </span>
          )}
        </div>
        {/* Hover action tray */}
        {item.preview_url && (
          <ImageActionTray
            imageUrl={item.preview_url}
            imagePath={item.livery_path}
            downloadName={`${item.display_name || item.car_folder}.png`}
          />
        )}
      </div>

      {/* Info */}
      <div className="p-2 flex flex-col gap-0.5">
        <div className="text-[11px] font-medium text-text-primary truncate">
          {item.display_name || item.car_folder}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-text-muted">
            {item.timestamp ? formatTimestamp(item.timestamp * 1000) : ''}
          </div>
          {item.cost != null && (
            <div className="text-[10px] text-warning">
              ${parseFloat(item.cost).toFixed(2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HistoryTab;
