import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '../common/Modal';

// ─── Category titles ─────────────────────────────────────────────────────────

const CATEGORY_TITLES = {
  wire: 'Browse Wireframes',
  base: 'Browse Base Textures',
  reference: 'Browse Reference Images',
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconTrash({ className = '' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function IconImage({ className = '' }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function IconCar({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
    </svg>
  );
}

// ─── Single upload card ──────────────────────────────────────────────────────

function UploadCard({ item, onSelect, onDelete }) {
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const previewUrl = `/api/uploads/preview?path=${encodeURIComponent(item.path)}`;

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(item);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleDeleteBlur = () => {
    // Reset confirm state when focus leaves
    setTimeout(() => setConfirmDelete(false), 200);
  };

  return (
    <div
      className="group relative flex flex-col bg-bg-card border border-border-default rounded-lg overflow-hidden cursor-pointer hover:border-accent/60 transition-all duration-150 hover:shadow-lg hover:shadow-accent/5"
      onClick={() => onSelect(item)}
      title={`Select ${item.name}`}
    >
      {/* Image area */}
      <div className="relative aspect-square bg-bg-input flex items-center justify-center overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-border-default border-t-accent rounded-full animate-spin" />
          </div>
        )}
        <img
          src={previewUrl}
          alt={item.name}
          className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          draggable={false}
        />

        {/* Delete button — top right */}
        <button
          onClick={handleDeleteClick}
          onBlur={handleDeleteBlur}
          className={`
            absolute top-1.5 right-1.5 w-7 h-7 rounded-md flex items-center justify-center
            transition-all duration-150 z-10
            ${confirmDelete
              ? 'bg-error text-white opacity-100 scale-100'
              : 'bg-bg-dark/70 text-text-muted opacity-0 group-hover:opacity-100 hover:text-error hover:bg-bg-dark/90'}
          `}
          title={confirmDelete ? 'Click again to confirm delete' : 'Delete'}
        >
          <IconTrash />
        </button>

        {/* Select overlay on hover */}
        <div className="absolute inset-0 bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />
      </div>

      {/* Info strip */}
      <div className="px-2 py-1.5 flex flex-col gap-0.5 min-w-0">
        <div className="text-[11px] text-text-primary truncate font-medium" title={item.name}>
          {item.name}
        </div>
        {item.car_display && (
          <div className="flex items-center gap-1 text-[10px] text-text-muted truncate">
            <IconCar className="flex-shrink-0 opacity-50" />
            <span className="truncate">{item.car_display}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ title, count, accent = false }) {
  return (
    <div className="flex items-center gap-2 px-1 pt-2 pb-1">
      <h3 className={`text-xs font-semibold uppercase tracking-wider ${accent ? 'text-accent' : 'text-text-muted'}`}>
        {title}
      </h3>
      <span className="text-[10px] text-text-muted bg-bg-input px-1.5 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export function BrowseUploadsModal({
  isOpen,
  onClose,
  category,
  currentCarFolder = '',
  currentCarDisplay = '',
  onBrowse,
  onSelect,
  onDelete,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load uploads when modal opens
  const loadItems = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    setError('');
    try {
      const data = await onBrowse(category);
      setItems(data || []);
    } catch (e) {
      setError('Failed to load uploads');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category, onBrowse]);

  useEffect(() => {
    if (isOpen) loadItems();
  }, [isOpen, loadItems]);

  // Split items into "this car" vs "other"
  const { associated, other } = useMemo(() => {
    if (!currentCarFolder) return { associated: [], other: items };
    const assoc = [];
    const rest = [];
    for (const item of items) {
      if (item.car_folder && item.car_folder === currentCarFolder) {
        assoc.push(item);
      } else {
        rest.push(item);
      }
    }
    return { associated: assoc, other: rest };
  }, [items, currentCarFolder]);

  const handleSelect = (item) => {
    onSelect?.(item);
    onClose();
  };

  const handleDelete = async (item) => {
    const result = await onDelete?.(item.path);
    if (result) {
      // Remove from local state immediately
      setItems(prev => prev.filter(i => i.path !== item.path));
    }
  };

  const title = CATEGORY_TITLES[category] || 'Browse Uploads';
  const totalCount = items.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="p-4 flex flex-col gap-2 min-h-[300px]">
        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-border-default border-t-accent rounded-full animate-spin" />
              <span className="text-xs text-text-muted">Loading uploads…</span>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex-1 flex items-center justify-center py-12">
            <span className="text-xs text-error">{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && totalCount === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
            <IconImage className="text-text-muted opacity-20" />
            <p className="text-sm text-text-muted">No uploads found</p>
            <p className="text-xs text-text-muted opacity-60">
              Upload images using the file uploader on the Generate tab
            </p>
          </div>
        )}

        {/* Items — split into associated / other */}
        {!loading && !error && totalCount > 0 && (
          <>
            {/* Associated with current car */}
            {associated.length > 0 && (
              <>
                <SectionHeader
                  title={currentCarDisplay || 'Current Car'}
                  count={associated.length}
                  accent
                />
                <div className="grid grid-cols-4 gap-2">
                  {associated.map(item => (
                    <UploadCard key={item.path} item={item} onSelect={handleSelect} onDelete={handleDelete} />
                  ))}
                </div>
              </>
            )}

            {/* Other uploads */}
            {other.length > 0 && (
              <>
                <SectionHeader
                  title={associated.length > 0 ? 'Other Uploads' : 'All Uploads'}
                  count={other.length}
                />
                <div className="grid grid-cols-4 gap-2">
                  {other.map(item => (
                    <UploadCard key={item.path} item={item} onSelect={handleSelect} onDelete={handleDelete} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export default BrowseUploadsModal;
