import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';

// ─── Reference context sample phrases ────────────────────────────────────────

const REFERENCE_CONTEXT_CATEGORIES = {
  "Color": [
    { title: "Match all colors", text: "Use the exact same colors as this reference image" },
    { title: "Use primary color only", text: "Use only the main color from this reference" },
    { title: "Color inspiration", text: "Take color inspiration from this but create something original" },
  ],
  "Pattern": [
    { title: "Copy stripe layout", text: "Replicate the stripes and pattern placement from this reference" },
    { title: "Use as graphic template", text: "Use the graphic shapes and layout from this reference on my car" },
    { title: "Extract one element", text: "Use just the main stripe or graphic element from this as the hero element" },
  ],
  "Full Livery": [
    { title: "Replicate exact design", text: "Recreate this livery as closely as possible on my car" },
    { title: "Match the style", text: "Create a livery with the same overall look and feel as this reference" },
    { title: "Use as inspiration", text: "Create something inspired by this livery but unique" },
  ],
};

export function ReferenceContextSamplesModal({ isOpen, onClose, onSelect }) {
  const categories = REFERENCE_CONTEXT_CATEGORIES;
  // categories is a module-level constant so the dep array is intentionally empty
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const categoryNames = useMemo(() => Object.keys(categories), []);
  const [activeCategory, setActiveCategory] = useState(null);

  const currentCategory = activeCategory && categoryNames.includes(activeCategory)
    ? activeCategory
    : categoryNames[0] || null;

  const items = currentCategory ? categories[currentCategory] : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reference Guidance Examples" size="xl">
      <div className="flex flex-col h-[70vh]">
        {/* Category tab bar */}
        <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto flex-shrink-0 border-b border-border-default">
          {categoryNames.map((name) => (
            <button
              key={name}
              onClick={() => setActiveCategory(name)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md whitespace-nowrap transition-all cursor-pointer ${
                currentCategory === name
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Phrase cards */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-2">
            {items.map((item) => (
              <button
                key={item.title}
                onClick={() => {
                  onSelect?.(item.text);
                  onClose();
                }}
                className="w-full text-left p-3 bg-bg-card border border-border-default rounded-lg hover:border-accent/40 hover:bg-bg-hover transition-all group cursor-pointer"
              >
                <div className="text-[13px] font-semibold text-text-primary mb-1 group-hover:text-accent transition-colors">
                  {item.title}
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
                  {item.text}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ReferenceContextSamplesModal;
