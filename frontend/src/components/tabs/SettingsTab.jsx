import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { WipeDataModal } from '../modals/WipeDataModal';
import { TrashModal } from '../modals/TrashModal';
import upscaleService from '../../services/UpscaleService';
import { useToastContext } from '../../context/ToastContext';
import { useConfigContext } from '../../context/ConfigContext';
import { useHistoryContext } from '../../context/HistoryContext';

export function SettingsTab({ capabilities }) {
  const { toast } = useToastContext();
  const { config, loading, saveConfig: onSaveConfig } = useConfigContext();
  const { trashCount, clearTrash } = useHistoryContext();
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [priceFlash1k, setPriceFlash1k] = useState('');
  const [priceFlash2k, setPriceFlash2k] = useState('');
  const [pricePro, setPricePro] = useState('');
  const [dataDir, setDataDir] = useState('');
  const [upscaleEngine, setUpscaleEngine] = useState('realesrgan');
  const [seedvr2UseGguf, setSeedvr2UseGguf] = useState(true);
  const [seedvr2MultiGpu, setSeedvr2MultiGpu] = useState(false);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [clearingTrash, setClearingTrash] = useState(false);

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
    setUpscaleEngine(config.upscale_engine || 'realesrgan');
    setSeedvr2UseGguf(config.seedvr2_use_gguf !== false);
    setSeedvr2MultiGpu(config.seedvr2_multi_gpu === true);
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
      upscale_engine: upscaleEngine,
      seedvr2_use_gguf: seedvr2UseGguf,
      seedvr2_multi_gpu: seedvr2MultiGpu,
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

  const handleClearTrash = async () => {
    setClearingTrash(true);
    try {
      const ok = await clearTrash();
      toast(ok ? 'Trash cleared' : 'Failed to clear trash', ok ? 'success' : 'error');
    } finally {
      setClearingTrash(false);
    }
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

      {/* Upscale Engine preference — show whenever at least one engine is available */}
      {(capabilities?.upscale_available || capabilities?.seedvr_available) && (
        <div className="flex flex-col gap-2 p-3 bg-bg-card rounded border border-border-default">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Auto-Upscale Engine
          </div>
          <div className="flex rounded-lg border border-border-default overflow-hidden">
            {[
              {
                id: 'realesrgan',
                label: 'Real-ESRGAN',
                sublabel: 'Fast (~30s)',
                available: capabilities?.upscale_available,
                installCmd: '--realesrgan',
                activeClass: 'bg-accent/15 text-accent border-b-2 border-accent/30',
              },
              {
                id: 'seedvr2',
                label: 'SeedVR2',
                sublabel: 'Higher quality (2-5m)',
                available: capabilities?.seedvr_available,
                installCmd: '--seedvr',
                activeClass: 'bg-accent-wine/15 text-accent-wine border-b-2 border-accent-wine/30',
              },
            ].map(({ id, label, sublabel, available, installCmd, activeClass }) => (
              <button
                key={id}
                onClick={() => available && setUpscaleEngine(id)}
                disabled={!available}
                title={!available ? `Not installed — re-launch with start.bat ${installCmd}` : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-3 text-[13px] font-medium transition-all border-b ${
                  !available
                    ? 'bg-bg-input text-text-muted opacity-40 cursor-not-allowed border-transparent'
                    : upscaleEngine === id
                    ? `${activeClass} cursor-pointer`
                    : 'bg-bg-input text-text-secondary hover:bg-bg-hover border-transparent cursor-pointer'
                }`}
              >
                <span className="text-[13px]">{label}</span>
                <span className={`text-[10px] font-normal ${upscaleEngine === id && available ? 'opacity-70' : 'text-text-muted'}`}>
                  {available ? sublabel : `start.bat ${installCmd}`}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-muted">
            Controls which engine is used for auto-upscale in the Generate tab. You can always switch engines directly from the Upscale tab.
          </p>

          {/* SeedVR2 sub-settings — only shown when SeedVR2 is selected */}
          {upscaleEngine === 'seedvr2' && capabilities?.seedvr_available && (
            <div className="flex flex-col gap-2 pt-1 border-t border-border-default">
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">SeedVR2 Options</div>

              {/* Use GGUF toggle */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-text-primary">Use GGUF Model</span>
                  <span className="text-[11px] text-text-muted">
                    Quantized 8-bit model — lower VRAM, slightly lower quality. Requires{' '}
                    <span className="font-mono text-text-secondary">seedvr2_ema_3b-Q8_0.gguf</span> in{' '}
                    <span className="font-mono text-text-secondary">seedvr2_videoupscaler/models/SEEDVR2/</span>.
                  </span>
                </div>
                <button
                  onClick={() => setSeedvr2UseGguf(v => !v)}
                  className={`flex-shrink-0 relative inline-flex h-5 w-9 rounded-full transition-colors ${
                    seedvr2UseGguf ? 'bg-accent' : 'bg-bg-hover border border-border-default'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform mt-[3px] ${
                    seedvr2UseGguf ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`} />
                </button>
              </div>

              {/* Multi-GPU toggle */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-text-primary">Multi-GPU Mode</span>
                  <span className="text-[11px] text-text-muted">
                    Use all detected NVIDIA GPUs in parallel. Only beneficial if you have 2+ compatible GPUs.
                  </span>
                </div>
                <button
                  onClick={() => setSeedvr2MultiGpu(v => !v)}
                  className={`flex-shrink-0 relative inline-flex h-5 w-9 rounded-full transition-colors ${
                    seedvr2MultiGpu ? 'bg-accent' : 'bg-bg-hover border border-border-default'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform mt-[3px] ${
                    seedvr2MultiGpu ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Trash */}
      <div className="flex flex-col gap-2 p-3 bg-bg-card rounded border border-border-default">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Trash
          </div>
          {trashCount > 0 && (
            <span className="px-2 py-0.5 text-[10px] bg-error/15 text-error rounded-full font-medium">
              {trashCount} item{trashCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-[11px] text-text-muted">
          {trashCount > 0
            ? `${trashCount} deleted liveri${trashCount !== 1 ? 'es' : 'y'} — will be permanently removed after 1 day.`
            : 'No items in trash. Deleted liveries are kept here for 1 day before permanent removal.'}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowTrashModal(true)}
            disabled={trashCount === 0}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            View Trash
          </Button>
          {trashCount > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleClearTrash}
              loading={clearingTrash}
            >
              Clear Trash
            </Button>
          )}
        </div>
      </div>

      <WipeDataModal isOpen={showWipeModal} onClose={() => setShowWipeModal(false)} />
      <TrashModal isOpen={showTrashModal} onClose={() => setShowTrashModal(false)} />
    </div>
  );
}

export default SettingsTab;
