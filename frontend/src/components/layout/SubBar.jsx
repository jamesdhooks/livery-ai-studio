import React, { useCallback } from 'react';
import { Button } from '../common/Button';
import { InfoTooltip } from '../common/InfoTooltip';
import { useToastContext } from '../../context/ToastContext';
import { useMonitorContext } from '../../context/MonitorContext';
import upscaleService from '../../services/UpscaleService';
import CarPicker from '../CarPicker';

// ── Icon helpers ──────────────────────────────────────────────────────────────

function IconFolder({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function IconActivity({ className = '' }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconX({ className = '' }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function SubBar({
  selectedCar,
  cars,
  onCarChange,
  onClearIRacing,
  onClearSpec,
  onDefaultLivery,
}) {
  const { toast } = useToastContext();
  const {
    active: monitorActive,
    monitor: monitorState,
    loading: monitorLoading,
    startMonitor,
    stopMonitor,
  } = useMonitorContext();

  // ── Folder picker ─────────────────────────────────────────────────────────
  const handlePickFolder = useCallback(async () => {
    if (!selectedCar) {
      toast('Select a car first before starting folder monitoring', 'error');
      return;
    }
    if (!startMonitor) return; // safety guard

    let folderPath = null;

    try {
      const data = await upscaleService.pickFolder();
      folderPath = data.path;
    } catch (e) {
      console.error('Folder picker failed:', e);
    }

    // If native picker not available (browser mode), fall back to text prompt
    // (browser can't access filesystem paths directly due to sandbox)
    if (!folderPath) {
      folderPath = window.prompt(
        'Enter the full folder path to monitor for auto-deploy\n' +
        '(e.g. C:\\Users\\You\\Documents\\MyLiveries or /home/user/liveries)',
        ''
      );
    }

    // Start monitoring with the path
    if (folderPath && folderPath.trim()) {
      await startMonitor(folderPath.trim(), selectedCar);
    }
  }, [selectedCar, startMonitor, toast]);
  const selectedCarData = cars.find((c) => c.folder === selectedCar);
  const tpUrl = selectedCarData?.trading_paints_url || '';
  const tplUrl = selectedCarData?.template_download_url || '';

  return (
    <div className="h-9 min-h-9 bg-bg-dark border-b border-border-default flex items-center px-3 gap-4 flex-shrink-0">
      {/* Car selector section */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-teal flex-shrink-0">
          Car
        </span>
        <CarPicker
          cars={cars}
          selectedFolder={selectedCar}
          onChange={onCarChange}
        />
        {tplUrl && (
          <a
            href={tplUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center px-2 h-[22px] rounded border border-border-default bg-bg-input text-[10px] text-text-secondary hover:text-accent hover:border-accent/40 transition-all duration-150 whitespace-nowrap flex-shrink-0"
          >
            Download Template
          </a>
        )}
        {tpUrl && (
          <a
            href={tpUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center px-2 h-[22px] rounded border border-border-default bg-bg-input text-[10px] text-text-secondary hover:text-accent hover:border-accent/40 transition-all duration-150 whitespace-nowrap flex-shrink-0"
          >
            View on Trading Paints
          </a>
        )}
      </div>

      {/* ── Monitor folder section ────────────────────────────────────────── */}
      {selectedCar && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!monitorActive ? (
            /* Inactive: show the "Monitor Folder" button + info icon */
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePickFolder}
                disabled={monitorLoading}
                className="flex items-center gap-1.5"
                title="Watch a folder and auto-deploy livery files to iRacing whenever they change"
              >
                <IconFolder />
                Monitor Folder
              </Button>
              <InfoTooltip position="bottom" maxWidth={310}>
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold text-text-primary">Monitor Folder</span>
                    <p className="text-text-muted mt-0.5">
                      Pick a folder that contains your livery files. The app will watch for{' '}
                      <code className="text-accent">car_&#123;id&#125;.tga</code> and{' '}
                      <code className="text-accent">car_spec_&#123;id&#125;.tga</code> and automatically
                      deploy them to your iRacing paint folder whenever they are saved.
                    </p>
                  </div>
                  <p className="text-text-muted text-[11px]">
                    Ideal for editing liveries live in Photoshop, GIMP, or any external editor —
                    every time you save, the file is instantly deployed to iRacing.
                  </p>
                  <p className="text-text-muted text-[11px]">
                    Both the diffuse (<code className="text-accent">car_&#123;id&#125;.tga</code>) and
                    specular (<code className="text-accent">car_spec_&#123;id&#125;.tga</code>) maps are watched.
                  </p>
                </div>
              </InfoTooltip>
            </div>
          ) : (
            /* Active: show status pill + Stop button */
            <div className="flex items-center gap-1.5">
              {/* Pulsing active indicator */}
              <div className="flex items-center gap-1 px-2 h-[22px] rounded border border-success/30 bg-success/10 text-success text-[10px] font-medium whitespace-nowrap max-w-[200px]">
                <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                </span>
                <IconActivity className="flex-shrink-0 text-success/80 ml-0.5" />
                <span className="truncate ml-0.5" title={monitorState?.folder || ''}>
                  {monitorState?.folder
                    ? monitorState.folder.split(/[\\/]/).pop()
                    : 'Monitoring'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopMonitor}
                disabled={monitorLoading}
                className="flex items-center gap-1 !text-error hover:!text-error"
                title="Stop folder monitoring"
              >
                <IconX />
                Stop
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Right side - iRacing ops (only when a car is selected) */}
      {selectedCar && (
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-accent-wine flex-shrink-0">
            iRacing
          </span>
          <InfoTooltip position="bottom" maxWidth={290}>
            <div className="space-y-2">
              <div>
                <span className="font-semibold text-text-primary">Deploy Default</span>
                <p className="text-text-muted mt-0.5">Copies the car's factory diffuse texture into your iRacing paint folder, restoring the stock appearance.</p>
              </div>
              <div>
                <span className="font-semibold text-text-primary">Clear Livery</span>
                <p className="text-text-muted mt-0.5">Removes your custom paint file from iRacing so the game falls back to the default or Trading Paints skin.</p>
              </div>
              <div>
                <span className="font-semibold text-text-primary">Clear Spec</span>
                <p className="text-text-muted mt-0.5">Removes your custom specular map from iRacing, restoring the default reflectivity and shine.</p>
              </div>
            </div>
          </InfoTooltip>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDefaultLivery();
              toast('Default livery deployed to iRacing', 'success');
            }}
            title="Deploy the car's default diffuse texture to iRacing"
          >
            Deploy Default
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClearIRacing();
              toast('Livery cleared from iRacing', 'success');
            }}
            title="Remove custom livery from iRacing paint folder"
          >
            Clear Livery
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClearSpec();
              toast('Specular map cleared from iRacing', 'success');
            }}
            title="Remove custom specular map from iRacing paint folder"
          >
            Clear Spec
          </Button>
        </div>
      )}
    </div>
  );
}

export default SubBar;
