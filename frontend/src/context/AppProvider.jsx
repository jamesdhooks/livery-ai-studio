import React from 'react';
import { ConfigProvider } from './ConfigContext';
import { SessionProvider } from './SessionContext';
import { CarsProvider } from './CarsContext';
import { GenerationPrefsProvider } from './GenerationPrefsContext';
import { HistoryProvider } from './HistoryContext';
import { SpendingProvider } from './SpendingContext';
import { GenerateProvider } from './GenerateContext';
import { UpscaleProvider } from './UpscaleContext';
import { SpecularProvider } from './SpecularContext';
import { ServiceErrorProvider } from './ServiceErrorContext.jsx';

/**
 * AppProvider — composes all context providers in the correct dependency order.
 *
 * Provider ordering (inner depends on outer):
 *   Toast (already in main.jsx)
 *     → ServiceError (for error modals)
 *       → Config
 *         → Session
 *           → Cars (needs Session)
 *           → GenerationPrefs (needs Session)
 *           → History
 *             → Spending (needs History)
 *               → Generate (needs Spending, Toast)
 *           → Upscale (needs Toast)
 *           → Specular (needs Toast)
 *
 * Usage in main.jsx:
 *   <ToastProvider>
 *     <AppProvider>
 *       <App />
 *     </AppProvider>
 *   </ToastProvider>
 */
export function AppProvider({ children }) {
  return (
    <ServiceErrorProvider>
      <ConfigProvider>
        <SessionProvider>
          <CarsProvider>
            <GenerationPrefsProvider>
              <HistoryProvider>
                <SpendingProvider>
                  <GenerateProvider>
                    <UpscaleProvider>
                      <SpecularProvider>
                        {children}
                      </SpecularProvider>
                    </UpscaleProvider>
                  </GenerateProvider>
                </SpendingProvider>
              </HistoryProvider>
            </GenerationPrefsProvider>
          </CarsProvider>
        </SessionProvider>
      </ConfigProvider>
    </ServiceErrorProvider>
  );
}
