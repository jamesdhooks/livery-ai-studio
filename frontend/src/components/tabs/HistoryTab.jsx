import React, { useEffect, useState, useCallback } from 'react';
import { ImageActionTray } from '../common/ImageActionTray';
import { LiveryDetailPanel } from '../common/LiveryDetailPanel';
import { formatTimestamp } from '../../utils/helpers';
import upscaleService from '../../services/UpscaleService';


export function HistoryTab({
  items,
  loading,
  onLoad,
  onDelete,
  onDeploy,
  deploying,
  onIterateFrom,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [fullResUrl, setFullResUrl] = useState(null);
  const [loadingFullRes, setLoadingFullRes] = useState(false);

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
  const meta = selectedItem
    ? [
        { label: 'Car', value: selectedItem.display_name || selectedItem.car_folder },
        { label: 'Model', value: selectedItem.model || '—', className: isProModel ? 'text-accent-wine' : 'text-accent' },
        { label: 'Resolution', value: selectedItem.resolution_2k ? '2K (2048×2048)' : '1K (1024×1024)', className: isProModel ? 'text-accent-wine/80' : 'text-accent/80' },
        { label: 'Cost', value: selectedItem.cost != null ? `$${parseFloat(selectedItem.cost).toFixed(2)}` : '—', className: 'text-warning' },
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
      <div className="flex-1 flex flex-col overflow-hidden bg-bg-dark">
        {selectedItem ? (
          <LiveryDetailPanel
            imageUrl={fullResUrl || selectedItem.preview_url}
            imagePath={selectedItem.livery_path}
            downloadName={`${selectedItem.display_name || selectedItem.car_folder}.png`}
            prompt={selectedItem.prompt}
            context={selectedItem.context}
            conversationLog={selectedItem.conversation_log}
            meta={meta}
            onDeploy={() => onDeploy?.(selectedItem.livery_path, selectedItem.car_folder, null)}
            deploying={deploying}
            onIterate={() => onIterateFrom?.(selectedItem)}
            onDelete={() => { onDelete?.(selectedItem.id); setSelectedId(null); }}
          />
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
          {modelLabel && (
            <span className={`px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white ${modelLabel === 'Pro' ? 'bg-accent-wine/80' : 'bg-accent/60'}`}>
              {modelLabel}
            </span>
          )}
          {resLabel && (
            <span className={`px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white ${resLabel === '2K' ? 'bg-success/70' : 'bg-text-muted/50'}`}>
              {resLabel}
            </span>
          )}
          {modeLabel && (
            <span className="px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white bg-warning/70">
              {modeLabel}
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
