import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useHistoryContext } from '../../context/HistoryContext';
import { useToastContext } from '../../context/ToastContext';

/**
 * TrashModal — shows trashed liveries with restore / clear options.
 */
export function TrashModal({ isOpen, onClose }) {
  const {
    trashItems,
    trashLoading,
    loadTrash,
    restoreFromTrash,
    restoreManyFromTrash,
    clearTrash,
  } = useHistoryContext();

  const { toast } = useToastContext();

  const [restoringPath, setRestoringPath] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState(new Set());

  // Load trash when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTrash();
      setSelectedPaths(new Set());
      setShowClearConfirm(false);
    }
  }, [isOpen, loadTrash]);

  const handleRestore = useCallback(async (path) => {
    setRestoringPath(path);
    try {
      const ok = await restoreFromTrash(path);
      if (ok) {
        toast('Livery restored', 'success');
      } else {
        toast('Failed to restore livery', 'error');
      }
    } finally {
      setRestoringPath(null);
    }
  }, [restoreFromTrash, toast]);

  const handleRestoreSelected = useCallback(async () => {
    if (!selectedPaths.size) return;
    setRestoringPath('__many__');
    try {
      const paths = Array.from(selectedPaths);
      const ok = await restoreManyFromTrash(paths);
      if (ok) {
        toast(`${paths.length} liveri${paths.length === 1 ? 'y' : 'es'} restored`, 'success');
        setSelectedPaths(new Set());
      } else {
        toast('Failed to restore some items', 'error');
      }
    } finally {
      setRestoringPath(null);
    }
  }, [selectedPaths, restoreManyFromTrash, toast]);

  const handleClearTrash = useCallback(async () => {
    setClearing(true);
    try {
      const ok = await clearTrash();
      if (ok) {
        toast('Trash cleared', 'success');
        setShowClearConfirm(false);
      } else {
        toast('Failed to clear trash', 'error');
      }
    } finally {
      setClearing(false);
    }
  }, [clearTrash, toast]);

  const toggleSelect = useCallback((path) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const getDaysLeft = (trashDate) => {
    if (!trashDate) return null;
    const msLeft = (trashDate * 1000 + 86_400_000) - Date.now();
    if (msLeft <= 0) return 'Expiring soon';
    const h = Math.floor(msLeft / 3_600_000);
    if (h < 1) return '< 1h left';
    if (h < 24) return `${h}h left`;
    return '~1 day left';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Trash" size="lg">
      <div className="flex flex-col h-full">
        {/* Header actions */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-default">
          {trashItems.length > 0 && (
            <>
              <button
                onClick={() => {
                  const allPaths = trashItems.map(i => i.livery_path || i.path).filter(Boolean);
                  setSelectedPaths(selectedPaths.size === allPaths.length ? new Set() : new Set(allPaths));
                }}
                className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
              >
                {selectedPaths.size === trashItems.length ? 'Deselect all' : 'Select all'}
              </button>

              {selectedPaths.size > 0 && (
                <Button
                  variant="success"
                  size="xs"
                  onClick={handleRestoreSelected}
                  loading={restoringPath === '__many__'}
                  disabled={!!restoringPath || clearing}
                >
                  Restore ({selectedPaths.size})
                </Button>
              )}

              <div className="flex-1" />

              {!showClearConfirm ? (
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={!!restoringPath || clearing}
                >
                  Clear Trash
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-error">Permanently delete all?</span>
                  <Button variant="danger" size="xs" onClick={handleClearTrash} loading={clearing} disabled={!!restoringPath}>
                    Yes, delete all
                  </Button>
                  <Button variant="secondary" size="xs" onClick={() => setShowClearConfirm(false)} disabled={clearing}>
                    Cancel
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 min-h-[200px] max-h-[60vh]">
          {trashLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : trashItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              <p className="text-sm">Trash is empty</p>
              <p className="text-xs text-text-muted opacity-70">Deleted liveries appear here for 1 day</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {trashItems.map((item) => {
                const path = item.livery_path || item.path;
                const isSelected = selectedPaths.has(path);
                const isRestoring = restoringPath === path;
                const daysLeft = getDaysLeft(item.trash_date);
                const isSpecItem = item.entry_type === 'spec' || item.mode === 'spec';

                return (
                  <div
                    key={item.id || path}
                    onClick={() => path && toggleSelect(path)}
                    className={`bg-bg-card border rounded-lg overflow-hidden cursor-pointer transition-all group relative flex flex-col ${
                      isSelected
                        ? 'border-accent ring-2 ring-accent/40'
                        : 'border-border-default hover:border-accent/30'
                    } ${isRestoring ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[4/3] bg-bg-dark overflow-hidden relative">
                      {item.preview_url ? (
                        <img
                          src={item.preview_url}
                          alt={item.display_name || item.car_folder}
                          className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-20">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                        </div>
                      )}
                      {/* Checkbox overlay */}
                      <div className="absolute top-1 left-1 pointer-events-none">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-accent border-accent' : 'bg-bg-panel/80 border-text-muted/60'
                        }`}>
                          {isSelected && (
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2 6 5 9 10 3" />
                            </svg>
                          )}
                        </div>
                      </div>
                      {/* Type badge */}
                      {isSpecItem && (
                        <div className="absolute top-1 right-1">
                          <span className="px-1 py-0.5 text-[8px] font-bold uppercase rounded text-white bg-success/70">Spec</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2 flex flex-col gap-1">
                      <div className="text-[11px] font-medium text-text-primary truncate">
                        {item.display_name || item.car_folder || item.name}
                      </div>
                      {daysLeft && (
                        <div className="text-[10px] text-error/80">{daysLeft}</div>
                      )}
                    </div>

                    {/* Restore button (shown on hover) */}
                    <div
                      className="absolute inset-x-0 bottom-0 bg-bg-panel/95 border-t border-border-default py-1.5 px-2 hidden group-hover:flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); path && handleRestore(path); }}
                    >
                      <span className="text-[11px] text-success font-medium flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 .49-4.49" />
                        </svg>
                        Restore
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {trashItems.length > 0 && (
          <div className="px-4 py-2 border-t border-border-default">
            <p className="text-[11px] text-text-muted">
              {trashItems.length} item{trashItems.length !== 1 ? 's' : ''} — automatically deleted after 1 day
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default TrashModal;
