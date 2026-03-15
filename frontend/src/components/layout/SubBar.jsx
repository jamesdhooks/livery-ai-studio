import React from 'react';
import { Button } from '../common/Button';
import { InfoTooltip } from '../common/InfoTooltip';
import CarPicker from '../CarPicker';

export function SubBar({
  selectedCar,
  cars,
  onCarChange,
  onClearIRacing,
  onClearSpec,
  onDefaultLivery,
}) {
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
            onClick={onDefaultLivery}
            title="Deploy the car's default diffuse texture to iRacing"
          >
            Deploy Default
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearIRacing}
            title="Remove custom livery from iRacing paint folder"
          >
            Clear Livery
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSpec}
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
