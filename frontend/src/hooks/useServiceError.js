import { useContext } from 'react';
import { ServiceErrorContext } from '../context/ServiceErrorContext';

/**
 * useServiceError — returns { error, isOpen, showError, closeError }
 *
 * showError(error) — display an error modal with the given error object
 * closeError() — close the error modal
 */
export function useServiceError() {
  const ctx = useContext(ServiceErrorContext);
  if (!ctx) throw new Error('useServiceError must be used inside <ServiceErrorProvider>');
  return ctx;
}
