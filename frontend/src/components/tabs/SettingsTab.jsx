import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { WipeDataModal } from '../modals/WipeDataModal';
import upscaleService from '../../services/UpscaleService';
import { useToastContext } from '../../context/ToastContext';
import { useConfigContext } from '../../context/ConfigContext';

export function SettingsTab() {
  const { toast } = useToastContext();
  const { config, loading, saveConfig: onSaveConfig } = useConfigContext();
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [priceFlash1k, setPriceFlash1k] = useState('');
  const [priceFlash2k, setPriceFlash2k] = useState('');
  const [pricePro, setPricePro] = useState('');
  const [dataDir, setDataDir] = useState('');
  const [showWipeModal, setShowWipeModal] = useState(false);

  useEffect(() => {
    if (!config) return;
    // gemini_api_key is stripped by the server GET — use gemini_api_key_set instead
    const keyIsSet = !!(config.gemini_api_key_set || config.gemini_api_key);
    setApiKey(keyIsSet ? '••••••••••••••••' : '');
    setApiKeyMasked(keyIsSet);
    setCustomerId(config.customer_id || '');
    setPriceFlash1k(String(config.price_flash_1k ?? 0.067));
    setPriceFlash2k(String(config.price_flash_2k ?? 0.101));
    setPricePro(String(config.price_pro ?? 0.134));
    setDataDir(config.data_dir || '');
  }, [config]);

  const handleApiKeyFocus = () => {
    if (apiKeyMasked) {
      setApiKey('');
      setApiKeyMasked(false);
    }
  };

  const handleSave = async () => {
    const updates = {
      customer_id: customerId,
      price_flash_1k: parseFloat(priceFlash1k) || 0.067,
      price_flash_2k: parseFloat(priceFlash2k) || 0.101,
      price_pro: parseFloat(pricePro) || 0.134,
      data_dir: dataDir,
    };
    if (!apiKeyMasked && apiKey) {
      updates.gemini_api_key = apiKey;
    }
    const ok = await onSaveConfig?.(updates);
    toast(
      ok ? 'Settings saved!' : 'Failed to save settings',
      ok ? 'success' : 'error'
    );
  };

  return (
    <div className="p-6 max-w-lg mx-auto flex flex-col gap-4 overflow-y-auto h-full">
      <h2 className="text-sm font-semibold text-text-primary">Settings</h2>

      {/* Gemini API Key */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Gemini API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onFocus={handleApiKeyFocus}
          placeholder="AIzaSy…"
          className="w-full px-3 py-2 text-[13px] bg-bg-input border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent font-mono transition-colors"
        />
        <p className="text-[11px] text-text-muted">
          Get your API key from{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            Google AI Studio
          </a>
        </p>
      </div>

      {/* iRacing Customer ID */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          iRacing Customer ID
        </label>
        <input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="123456"
          className="w-full px-3 py-2 text-[13px] bg-bg-input border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
        />
        <p className="text-[11px] text-text-muted">
          Log in to{' '}
          <a href="https://members.iracing.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">members.iracing.com</a>
          {' '}and go to <strong className="text-text-primary">My Info</strong> to find your Customer ID
        </p>
      </div>

      {/* Pricing overrides */}
      <div className="flex flex-col gap-2 p-3 bg-bg-card rounded border border-border-default">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          API Pricing (USD per image)
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Flash 1K', value: priceFlash1k, setter: setPriceFlash1k },
            { label: 'Flash 2K', value: priceFlash2k, setter: setPriceFlash2k },
            { label: 'Pro', value: pricePro, setter: setPricePro },
          ].map(({ label, value, setter }) => (
            <div key={label} className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted">{label}</label>
              <input
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="px-2 py-1.5 text-[13px] bg-bg-input border border-border-default rounded text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-text-muted">
          Update if Google changes their pricing. These are used only for cost display.
          See{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/pricing"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            current Gemini pricing
          </a>{' '}
          for the latest rates.
        </p>
      </div>

      {/* Data Directory */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Data Directory (optional)
        </label>
        <div className="flex gap-2 items-start">
          <div className="flex-1 min-w-0 px-3 py-2 text-[13px] bg-bg-input border border-border-default rounded text-text-primary font-mono min-h-[36px] flex items-center break-all">
            {dataDir || <span className="text-text-muted">Default (app_dir/data)</span>}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="flex-shrink-0"
            onClick={async () => {
              try {
                const data = await upscaleService.pickFolder();
                if (data.path) setDataDir(data.path);
              } catch (e) { console.error('Folder picker failed:', e); }
            }}
          >
            Browse
          </Button>
          {dataDir && (
            <Button variant="ghost" size="sm" className="flex-shrink-0" onClick={() => setDataDir('')}>
              Reset
            </Button>
          )}
        </div>
      </div>

      <Button variant="primary" size="md" onClick={handleSave} loading={loading}>
        {loading ? 'Loading Settings…' : 'Save Settings'}
      </Button>

      {/* Danger zone */}
      <div className="flex flex-col gap-2 p-3 bg-accent-wine/5 rounded border border-accent-wine/20 mt-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-accent-wine">
          Danger Zone
        </div>
        <p className="text-[11px] text-text-muted">
          Permanently delete all generated liveries, history, uploads, and session state.
          Your settings (API key, customer ID) will be preserved.
        </p>
        <Button variant="danger" size="sm" onClick={() => setShowWipeModal(true)}>
          Wipe All Data
        </Button>
      </div>

      <WipeDataModal isOpen={showWipeModal} onClose={() => setShowWipeModal(false)} />
    </div>
  );
}

export default SettingsTab;
