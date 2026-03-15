import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import configService from '../../services/ConfigService';

export function WipeDataModal({ isOpen, onClose }) {
  const [confirmation, setConfirmation] = useState('');
  const [wiping, setWiping] = useState(false);
  const [status, setStatus] = useState(null);

  const canWipe = confirmation.trim().toLowerCase() === 'wipe my data';

  const handleWipe = async () => {
    if (!canWipe) return;
    setWiping(true);
    setStatus(null);
    try {
      await configService.wipeData(confirmation.trim());
      setStatus({ type: 'success', message: 'All data wiped successfully. Reload the app to start fresh.' });
      setConfirmation('');
    } catch (e) {
      setStatus({ type: 'error', message: `Failed to wipe data: ${e.message}` });
    } finally {
      setWiping(false);
    }
  };

  const handleClose = () => {
    setConfirmation('');
    setStatus(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Wipe All Data" size="md">
      <div className="p-5 flex flex-col gap-4">
        {/* Warning */}
        <div className="bg-error/10 border border-error/30 rounded-lg p-4 flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-error flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-[13px] font-semibold text-error mb-1">This action is irreversible</p>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              This will permanently delete all your generated liveries, upload history,
              generation history, and session state. Your settings (API key, customer ID,
              pricing overrides) will be preserved.
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-bg-card border border-border-default rounded-lg p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
            What will be deleted
          </div>
          <ul className="text-[12px] text-text-secondary space-y-1.5 ml-4 list-disc">
            <li>All generated livery TGA files and PNG previews</li>
            <li>All uploaded wireframes, base textures, and references</li>
            <li>Generation history and prompt history</li>
            <li>Session state (last prompt, selected car, mode)</li>
            <li>Any user-imported car templates</li>
          </ul>
        </div>

        {/* Confirmation input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] text-text-secondary">
            Type <code className="bg-bg-input px-1.5 py-0.5 rounded text-accent font-mono text-[12px]">wipe my data</code> to confirm:
          </label>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="wipe my data"
            className="w-full px-3 py-2 text-[13px] bg-bg-input border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-error transition-colors"
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {/* Status */}
        {status && (
          <div className={`text-[12px] ${status.type === 'success' ? 'text-success' : 'text-error'}`}>
            {status.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleWipe}
            disabled={!canWipe || wiping}
            loading={wiping}
          >
            Wipe All Data
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default WipeDataModal;
