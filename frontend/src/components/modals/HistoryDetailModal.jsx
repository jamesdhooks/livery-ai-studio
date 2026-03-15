import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatTimestamp } from '../../utils/helpers';

export function HistoryDetailModal({
  isOpen,
  onClose,
  item,
  onDeploy,
  onIterate,
  onUpscale,
  onDelete,
  deploying,
  upscaling,
}) {
  if (!item) return null;

  const meta = [
    { label: 'Car', value: item.display_name || item.car_folder },
    { label: 'Model', value: item.model || '—' },
    { label: 'Resolution', value: item.resolution_2k ? '2K (2048×2048)' : '1K (1024×1024)' },
    { label: 'Cost', value: item.cost != null ? `$${parseFloat(item.cost).toFixed(2)}` : '—' },
    { label: 'Generated', value: item.timestamp ? formatTimestamp(item.timestamp * 1000) : '—' },
    { label: 'File', value: item.livery_path || '—' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generation Detail" size="xl">
      <div className="flex h-full min-h-0" style={{ maxHeight: 'calc(85vh - 60px)' }}>
        {/* Preview */}
        <div className="flex-1 flex items-center justify-center bg-bg-dark p-4">
          {item.preview_url ? (
            <img
              src={item.preview_url}
              alt={item.display_name || item.car_folder}
              className="max-w-full max-h-full object-contain rounded"
            />
          ) : (
            <div className="text-text-muted">No preview</div>
          )}
        </div>

        {/* Details panel */}
        <div className="w-64 flex-shrink-0 border-l border-border-default flex flex-col overflow-y-auto">
          <div className="p-4 flex flex-col gap-3">
            {/* Prompt */}
            {item.prompt && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                  Prompt
                </div>
                <p className="text-xs text-text-secondary leading-relaxed bg-bg-input p-2 rounded border border-border-default">
                  {item.prompt}
                </p>
              </div>
            )}

            {/* Context */}
            {item.context && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                  Context
                </div>
                <p className="text-xs text-text-secondary leading-relaxed bg-bg-input p-2 rounded border border-border-default">
                  {item.context}
                </p>
              </div>
            )}

            {/* Meta table */}
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                Details
              </div>
              {meta.map(({ label, value }) => (
                <div key={label} className="flex flex-col py-1 border-b border-border-default/50">
                  <span className="text-[9px] text-text-muted uppercase tracking-wide">{label}</span>
                  <span className="text-xs text-text-primary break-all">{value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5 mt-auto">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onDeploy?.(item.livery_path, item.car_folder, null)}
                disabled={deploying}
                loading={deploying}
                className="w-full"
              >
                Deploy to iRacing
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { onIterate?.(item); onClose(); }}
                className="w-full"
              >
                Iterate from this
              </Button>
              {item.upscale_available && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onUpscale?.(item.livery_path)}
                  disabled={upscaling}
                  loading={upscaling}
                  className="w-full"
                >
                  Upscale 4x
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={() => { onDelete?.(item.id); onClose(); }}
                className="w-full"
              >
                🗑 Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default HistoryDetailModal;
