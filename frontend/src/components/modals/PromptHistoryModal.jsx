import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatTimestamp } from '../../utils/helpers';

export function PromptHistoryModal({ isOpen, onClose, historyItems = [], onSelectPrompt }) {
  const promptItems = historyItems
    .filter((item) => item.prompt)
    .slice(0, 50);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Prompt History" size="md">
      <div className="p-3 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
        {promptItems.length === 0 && (
          <div className="py-8 text-center text-xs text-text-muted">
            No prompt history yet
          </div>
        )}
        {promptItems.map((item) => (
          <div
            key={item.id}
            className="p-3 bg-bg-card border border-border-default rounded-lg hover:border-accent/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="text-[10px] text-text-muted">
                {item.display_name || item.car_folder}
                {item.timestamp && ` · ${formatTimestamp(item.timestamp * 1000)}`}
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  onSelectPrompt?.(item.prompt);
                  onClose();
                }}
                className="flex-shrink-0"
              >
                Use
              </Button>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
              {item.prompt}
            </p>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default PromptHistoryModal;
