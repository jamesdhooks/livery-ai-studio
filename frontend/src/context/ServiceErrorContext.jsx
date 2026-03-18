import React, { useState, useCallback } from 'react';
import { ServiceErrorContext } from './ServiceErrorContext';

/**
 * ServiceErrorProvider — wraps the app and provides service error handling.
 *
 * Displays user-friendly modal dialogs for service errors instead of raw
 * error notifications.
 */
export function ServiceErrorProvider({ children }) {
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const showError = useCallback((err) => {
    // Parse error object to extract message and code
    let errorObj = err;
    if (typeof err === 'string') {
      errorObj = { message: err };
    }

    setError(errorObj);
    setIsOpen(true);
  }, []);

  const closeError = useCallback(() => {
    setIsOpen(false);
    // Clear the error after the modal closes
    setTimeout(() => setError(null), 300);
  }, []);

  const value = { error, isOpen, showError, closeError };

  return (
    <ServiceErrorContext.Provider value={value}>
      {children}
    </ServiceErrorContext.Provider>
  );
}
