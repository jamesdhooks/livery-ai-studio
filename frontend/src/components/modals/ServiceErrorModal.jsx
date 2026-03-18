import React from 'react';
import { InfoModal } from '../common/InfoModal';

export function ServiceErrorModal({ isOpen, onClose, error }) {
  if (!error) return null;

  // Detect specific error types and provide friendly messages
  const getErrorInfo = () => {
    const msg = error.message || error.toString();
    
    // VRAM exhaustion error (SeedVR2)
    if (error.code === 'OUT_OF_VRAM' || msg.includes('out of memory') || msg.includes('Out of VRAM')) {
      return {
        title: 'Out of VRAM',
        description: 'Your GPU doesn\'t have enough memory for this operation.',
        icon: 'memory',
        variant: 'memory',
        details: (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-text-primary">Solutions:</p>
            <ul className="space-y-2 pl-4">
              <li className="text-sm text-text-muted flex items-start gap-2">
                <span className="text-text-secondary mt-0.5">•</span>
                <span>Lower the input resolution</span>
              </li>
              <li className="text-sm text-text-muted flex items-start gap-2">
                <span className="text-text-secondary mt-0.5">•</span>
                <span>Download the GGUF model (see GGUF instructions in the README)</span>
              </li>
              <li className="text-sm text-text-muted flex items-start gap-2">
                <span className="text-text-secondary mt-0.5">•</span>
                <span>Switch to the ESRGAN engine instead of SeedVR2</span>
              </li>
            </ul>
          </div>
        ),
        actionLabel: 'Dismiss',
      };
    }

    // Gemini API 503 Service Unavailable
    if (error.code === 503 || msg.includes('503') || msg.includes('UNAVAILABLE')) {
      return {
        title: 'Google API Overloaded',
        description: 'Google\'s AI services are currently experiencing high demand.',
        icon: 'warning',
        variant: 'warning',
        details: 'This is usually temporary. Please wait a moment and try again.',
        actionLabel: 'Dismiss',
      };
    }

    // Generic server error
    if (error.code >= 500 || msg.includes('500')) {
      return {
        title: 'Server Error',
        description: 'The backend encountered an unexpected error.',
        icon: 'error',
        variant: 'error',
        details: msg,
        actionLabel: 'Dismiss',
      };
    }

    // Generic client error
    if (error.code >= 400 || msg.includes('400')) {
      return {
        title: 'Invalid Request',
        description: 'There was a problem with your request.',
        icon: 'warning',
        variant: 'warning',
        details: msg,
        actionLabel: 'Dismiss',
      };
    }

    // Default
    return {
      title: 'Error',
      description: 'An error occurred.',
      icon: 'error',
      variant: 'error',
      details: msg,
      actionLabel: 'Dismiss',
    };
  };

  const info = getErrorInfo();

  return (
    <InfoModal 
      isOpen={isOpen} 
      onClose={onClose}
      title={info.title}
      description={info.description}
      details={info.details}
      icon={info.icon}
      variant={info.variant}
      actionLabel={info.actionLabel}
    />
  );
}

export default ServiceErrorModal;
