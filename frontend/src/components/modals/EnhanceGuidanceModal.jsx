import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import generateService from '../../services/GenerateService';

export function EnhanceGuidanceModal({ isOpen, onClose }) {
  const [guidance, setGuidance] = useState('');
  const [defaultGuidance, setDefaultGuidance] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setStatus(null);
    generateService.getEnhanceGuidance()
      .then((data) => {
        setGuidance(data.guidance || '');
        setDefaultGuidance(data.default || '');
      })
      .catch(() => setStatus({ type: 'error', message: 'Failed to load guidance' }))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await generateService.saveEnhanceGuidance(guidance.trim());
      setStatus({ type: 'success', message: 'Guidance saved!' });
      setTimeout(() => onClose(), 800);
    } catch {
      setStatus({ type: 'error', message: 'Failed to save guidance' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setGuidance(defaultGuidance);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enhance Prompt Settings" size="lg">
      <div className="flex flex-col gap-4 p-4">
        <p className="text-[13px] text-text-secondary leading-relaxed">
          Customise the guidance used when enhancing prompts with AI. This tells the AI how to
          expand and improve your brief descriptions into detailed livery prompts.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <textarea
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            rows={14}
            className="w-full px-4 py-3 text-[13px] bg-bg-input border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none transition-colors font-mono leading-relaxed"
            placeholder="Enter custom enhancement guidelines…"
          />
        )}

        {status && (
          <div className={`text-xs ${status.type === 'success' ? 'text-success' : 'text-error'}`}>
            {status.message}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={loading}>
            Reset to Default
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={loading}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default EnhanceGuidanceModal;
