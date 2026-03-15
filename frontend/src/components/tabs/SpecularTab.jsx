import React from 'react';

export function SpecularTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-5xl opacity-20">◇</div>
      <h2 className="text-base font-semibold text-text-primary">Specular Maps</h2>
      <p className="text-sm text-text-muted text-center max-w-xs">
        Generate specular/reflective maps for your livery. Coming soon.
      </p>
      <div className="px-3 py-1.5 bg-bg-card border border-border-default rounded text-xs text-text-muted">
        Coming Soon
      </div>
    </div>
  );
}

export default SpecularTab;
