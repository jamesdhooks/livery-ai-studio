import React from 'react';
import { Toggle } from './Toggle';
import { InfoTooltip } from './InfoTooltip';
import { formatCost } from '../../utils/pricing';

/**
 * ModelSelector — shared model & resolution picker for Generate and Specular tabs.
 *
 * @param {Object} props
 * @param {string} props.model - Current model ('flash' or 'pro')
 * @param {Function} props.onModelChange - Callback when model changes
 * @param {boolean} props.is2K - Current 2K setting
 * @param {Function} props.onIs2KChange - Callback when 2K setting changes
 * @param {number} props.cost - Estimated cost
 * @param {string} [props.sessionKey] - Session storage prefix ('last_model' or 'last_spec_model')
 * @param {Function} [props.onSaveSession] - Session save callback
 * @param {Object} [props.config] - Config object for pricing
 */
export function ModelSelector({
  model,
  onModelChange,
  is2K,
  onIs2KChange,
  cost,
  sessionKey = 'last_model',
  onSaveSession,
  config,
}) {
  const handleModelClick = (newModel) => {
    onModelChange(newModel);
    if (onSaveSession && sessionKey) {
      onSaveSession({ [sessionKey]: newModel });
    }
  };

  const handleIs2KChange = (value) => {
    onIs2KChange(value);
    const is2kKey = sessionKey === 'last_spec_model' ? 'last_spec_is_2k' : 'last_is_2k';
    if (onSaveSession) {
      onSaveSession({ [is2kKey]: value });
    }
  };

  const isPro = model === 'pro';
  const resLabel = (isPro || is2K) ? '2048 px' : '1024 px';

  return (
    <div className="flex flex-col rounded-lg border border-border-default overflow-hidden">
      {/* Segmented model buttons */}
      <div className="flex">
        {[
          {
            id: 'flash',
            label: 'Flash',
            sublabel: 'Fast · Affordable',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            ),
            activeClass: 'bg-accent/15 text-accent border-accent/30',
          },
          {
            id: 'pro',
            label: 'Pro',
            sublabel: 'Best quality',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20.02L12 17.27L7.09 20.02L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
              </svg>
            ),
            activeClass: 'bg-accent-wine/15 text-accent-wine border-accent-wine/30',
          },
        ].map(({ id, label, sublabel, icon, activeClass }) => (
          <button
            key={id}
            onClick={() => handleModelClick(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-3 text-[13px] font-medium transition-all cursor-pointer border-b-2 ${
              model === id
                ? activeClass
                : 'bg-bg-input text-text-secondary hover:bg-bg-hover border-transparent'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {icon}
              {label}
            </span>
            <span className={`text-[10px] font-normal ${model === id ? 'opacity-70' : 'text-text-muted'}`}>
              {sublabel}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom bar — resolution toggle + cost */}
      <div className="flex items-center gap-3 px-3 py-2 bg-bg-card border-t border-border-default">
        {/* Resolution toggle */}
        <div className="flex items-center gap-1.5 flex-1">
          <Toggle
            checked={isPro ? true : is2K}
            onChange={handleIs2KChange}
            id={`resolution-${sessionKey}`}
            size="sm"
            disabled={isPro}
          />
          <span className={`text-[12px] ${isPro || is2K ? 'text-text-secondary' : 'text-text-muted'}`}>
            2K
          </span>
          <InfoTooltip
            position="right"
            maxWidth={260}
            text={isPro ? 'Pro always generates at 2048 px for maximum fidelity.' : 'Forces Flash to generate at 2048 px (~$0.101/image) instead of 1024 px. Pro always uses 2K.'}
          />
        </div>

        {/* Cost pill */}
        {cost !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
            isPro
              ? 'bg-accent-wine/10 text-accent-wine'
              : 'bg-accent/10 text-accent'
          }`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9.5h4.5a1.5 1.5 0 010 3H10.5a1.5 1.5 0 000 3H15" />
            </svg>
            {formatCost(cost)}
            <span className="text-[10px] opacity-60">/ gen</span>
          </div>
        )}

        {/* Resolution label */}
        <span className="text-[10px] text-text-muted">{resLabel}</span>
      </div>
    </div>
  );
}
