import React, { useState, useCallback, useEffect } from 'react';
import { TopBar } from './layout/TopBar';
import { SubBar } from './layout/SubBar';
import { GenerateTab } from './tabs/GenerateTab';
import { HistoryTab } from './tabs/HistoryTab';
import { UpscaleTab } from './tabs/UpscaleTab';
import { SponsorsTab } from './tabs/SponsorsTab';
import { SpecularTab } from './tabs/SpecularTab';
import { SettingsTab } from './tabs/SettingsTab';
import { GettingStartedTab } from './tabs/GettingStartedTab';
import { CarsTab } from './tabs/CarsTab';
import { SamplePromptsModal } from './modals/SamplePromptsModal';
import { SpendingModal } from './modals/SpendingModal';
import { PromptHistoryModal } from './modals/PromptHistoryModal';
import { useConfigContext } from '../context/ConfigContext';
import { useSessionContext } from '../context/SessionContext';
import { useCarsContext } from '../context/CarsContext';
import { useGenerateContext } from '../context/GenerateContext';
import { useHistoryContext } from '../context/HistoryContext';
import { useSpendingContext } from '../context/SpendingContext';
import { useUpscaleContext } from '../context/UpscaleContext';
import { useSpecularContext } from '../context/SpecularContext';
import { useTheme } from '../hooks/useTheme';
import generateService from '../services/GenerateService';
import upscaleService from '../services/UpscaleService';
import logService from '../services/LogService';

function App() {
  // ── Local UI state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('lastActiveTab') || 'getting-started';
    } catch {
      return 'getting-started';
    }
  });
  const [spendFilter, setSpendFilter] = useState('overall');
  const [capabilities, setCapabilities] = useState({ upscale_available: false });

  // Modals
  const [showSamplePrompts, setShowSamplePrompts] = useState(false);
  const [showSpending, setShowSpending] = useState(false);
  const [showPromptHistory, setShowPromptHistory] = useState(false);

  // Prompt injection state (from modals → GenerateTab)
  const [injectedPrompt, setInjectedPrompt] = useState(null);
  const [iteratePath, setIteratePath] = useState(null);
  const [regenerateData, setRegenerateData] = useState(null);

  // ── Contexts ──────────────────────────────────────────────────────────────
  const { config, loading: configLoading, saveConfig } = useConfigContext();
  const { session, saveSession } = useSessionContext();
  const {
    cars, carsLoading, selectedCar, setSelectedCar, onCarChange,
    carWireUrl, carDiffuseUrl, setBaseOverride,
  } = useCarsContext();
  const { generating, result: generateResult, status: generateStatus } = useGenerateContext();
  const { items: historyItems, loading: historyLoading, loadHistory } = useHistoryContext();
  const {
    entries, totalSpend, lastTransaction,
  } = useSpendingContext();
  const { deploying } = useUpscaleContext();
  const { theme, setTheme } = useTheme();

  // ── Derived state / effects ───────────────────────────────────────────────
  useEffect(() => {
    if (config) {
      setCapabilities({ upscale_available: config.upscale_available || false });
    }
  }, [config]);

  // Reload history whenever the history tab is opened
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Sync spendFilter from config on load
  useEffect(() => {
    if (config?.spend_filter) setSpendFilter(config.spend_filter);
  }, [config?.spend_filter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    try { localStorage.setItem('lastActiveTab', tab); } catch {}
  }, []);

  const handleSpendFilterChange = useCallback((f) => {
    setSpendFilter(f);
    saveConfig({ spend_filter: f });
  }, [saveConfig]);

  const handleClearIRacing = useCallback(async () => {
    try {
      if (!selectedCar) return;
      await upscaleService.clearPaint(selectedCar, 'texture');
    } catch (e) {
      logService.log(`[clear] Error: ${e.message}`);
    }
  }, [selectedCar]);

  const handleClearSpec = useCallback(async () => {
    try {
      if (!selectedCar) return;
      await upscaleService.clearPaint(selectedCar, 'spec');
    } catch (e) {
      logService.log(`[clear-spec] Error: ${e.message}`);
    }
  }, [selectedCar]);

  const handleDefaultLivery = useCallback(async () => {
    try {
      if (!selectedCar) return;
      await upscaleService.deployDefault(selectedCar);
    } catch (e) {
      logService.log(`[default-livery] Error: ${e.message}`);
    }
  }, [selectedCar]);

  const handleIterateFrom = useCallback((item) => {
    if (item.livery_path) {
      setBaseOverride(item.livery_path);
    }
    setIteratePath(item.livery_path || null);
    setActiveTab('generate');
  }, [setBaseOverride]);

  const handleRegenerateFrom = useCallback((item) => {
    setRegenerateData({ prompt: item.prompt || '', context: item.context || '' });
    setActiveTab('generate');
    saveSession({ last_mode: 'new' });
  }, [saveSession]);

  const handleNavigateToHistory = useCallback((itemId) => {
    setActiveTab('history');
    try { sessionStorage.setItem('history-focus-id', itemId); } catch {}
  }, []);

  const handleEnhancePrompt = useCallback(async (prompt, context, mode) => {
    try {
      return await generateService.enhancePrompt(prompt, context, mode);
    } catch (e) {
      logService.log(`[enhance] Error: ${e.message}`);
      return null;
    }
  }, []);

  const handleNavigateToSpecular = useCallback((liveryPath, carFolder) => {
    if (carFolder) {
      setSelectedCar(carFolder);
      saveSession({ last_car: carFolder });
    }
    setBaseOverride(liveryPath);
    saveSession({ last_mode: 'modify' });
    setActiveTab('specular');
  }, [setSelectedCar, setBaseOverride, saveSession]);

  // ── App loading splash ────────────────────────────────────────────────────
  if (configLoading || carsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bg-dark gap-5">
        <img src="/icon.png" alt="Livery AI Studio" width="72" height="72" className="rounded-xl mb-1" />
        <div className="text-[22px] font-bold text-text-primary tracking-tight">
          Livery <span className="text-accent-teal">A</span><span className="text-accent-wine">I</span> Studio
        </div>
        <svg className="animate-spin text-text-muted" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-dark text-text-primary">
      <TopBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        totalSpend={(() => {
          if (spendFilter === 'overall') return totalSpend;
          const now = Date.now();
          const cutoff = spendFilter === 'today'
            ? now - 24 * 60 * 60 * 1000
            : now - 7 * 24 * 60 * 60 * 1000;
          return (entries ?? [])
            .filter(e => (e.ts ?? 0) * 1000 >= cutoff)
            .reduce((s, e) => s + (e.cost ?? 0), 0);
        })()}
        spendFilter={spendFilter}
        onSpendingClick={() => setShowSpending(true)}
        historyLoading={historyLoading}
        generating={generating}
        theme={theme}
        onThemeChange={setTheme}
        lastTransaction={lastTransaction}
      />

      <SubBar
        selectedCar={selectedCar}
        cars={cars}
        onCarChange={onCarChange}
        onClearIRacing={handleClearIRacing}
        onClearSpec={handleClearSpec}
        onDefaultLivery={handleDefaultLivery}
      />

      {/* Tab panels */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'generate' && (
          <GenerateTab
            capabilities={capabilities}
            injectedPrompt={injectedPrompt}
            onInjectedPromptUsed={() => setInjectedPrompt(null)}
            onEnhancePrompt={handleEnhancePrompt}
            iteratePath={iteratePath}
            onIteratePathUsed={() => setIteratePath(null)}
            regenerateData={regenerateData}
            onRegenerateDataUsed={() => setRegenerateData(null)}
            onNavigateToSpecular={() => setActiveTab('specular')}
            onOpenSamplePrompts={() => setShowSamplePrompts(true)}
            onOpenPromptHistory={() => setShowPromptHistory(true)}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab
            onIterateFrom={handleIterateFrom}
            onRegenerateFrom={handleRegenerateFrom}
            onNavigateToSpecular={handleNavigateToSpecular}
            onSwitchTab={setActiveTab}
          />
        )}
        {activeTab === 'upscale' && (
          <UpscaleTab
            capabilities={capabilities}
          />
        )}
        <div className={activeTab === 'cars' ? 'h-full overflow-hidden' : 'hidden'}>
          <CarsTab
            onNavigateToHistory={handleNavigateToHistory}
          />
        </div>
        {activeTab === 'sponsors' && <SponsorsTab />}
        {activeTab === 'specular' && (
          <SpecularTab
            capabilities={capabilities}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab />
        )}
        {activeTab === 'getting-started' && <GettingStartedTab />}
      </main>

      {/* Modals */}
      <SamplePromptsModal
        isOpen={showSamplePrompts}
        onClose={() => setShowSamplePrompts(false)}
        mode={session?.last_mode || 'new'}
        onSelectPrompt={(prompt) => {
          setInjectedPrompt(prompt);
          setShowSamplePrompts(false);
        }}
      />

      <SpendingModal
        isOpen={showSpending}
        onClose={() => setShowSpending(false)}
        spendingEntries={entries}
        historyItems={historyItems}
        spendFilter={spendFilter}
        onFilterChange={handleSpendFilterChange}
      />

      <PromptHistoryModal
        isOpen={showPromptHistory}
        onClose={() => setShowPromptHistory(false)}
        historyItems={historyItems}
        onSelectPrompt={(prompt) => {
          setInjectedPrompt(prompt);
          setShowPromptHistory(false);
        }}
      />
    </div>
  );
}

export default App;
