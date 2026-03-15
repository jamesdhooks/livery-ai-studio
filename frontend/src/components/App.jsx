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
import { useConfig } from '../hooks/useConfig';
import { useSession } from '../hooks/useSession';
import { useCars } from '../hooks/useCars';
import { useGenerate } from '../hooks/useGenerate';
import { useHistory } from '../hooks/useHistory';
import { useUpscale } from '../hooks/useUpscale';
import { useTheme } from '../hooks/useTheme';
import { useCarOverrides } from '../hooks/useCarOverrides';
import generateService from '../services/GenerateService';
import upscaleService from '../services/UpscaleService';
import logService from '../services/LogService';

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('lastActiveTab') || 'getting-started';
    } catch {
      return 'getting-started';
    }
  });
  const [selectedCar, setSelectedCar] = useState('');
  const [spendFilter, setSpendFilter] = useState('overall');
  const [carWireUrl, setCarWireUrl] = useState('');
  const [carDiffuseUrl, setCarDiffuseUrl] = useState('');
  const [capabilities, setCapabilities] = useState({ upscale_available: false });

  // Modals
  const [showSamplePrompts, setShowSamplePrompts] = useState(false);
  const [showSpending, setShowSpending] = useState(false);
  const [showPromptHistory, setShowPromptHistory] = useState(false);


  // Prompt injection state (from modals → GenerateTab)
  const [injectedPrompt, setInjectedPrompt] = useState(null);

  // Hooks
  const { config, loading: configLoading, saveConfig } = useConfig();
  const { session, saveSession } = useSession();
  const { cars, loading: carsLoading, getWireframeUrl, getDiffuseUrl } = useCars();
  const {
    generating,
    result: generateResult,
    status: generateStatus,
    generate,
    uploadFile,
    browseUploads,
    deleteUpload,
    clearStatus: clearGenerateStatus,
  } = useGenerate();
  const {
    items: historyItems,
    loading: historyLoading,
    loadHistory,
    deleteItem: deleteHistory,
    getTotalSpend,
  } = useHistory();
  const {
    upscaling,
    deploying,
    result: upscaleResult,
    status: upscaleStatus,
    upscale,
    deploy,
    clearStatus: clearUpscaleStatus,
  } = useUpscale();

  const { theme, setTheme } = useTheme();
  const {
    wireOverride,
    baseOverride,
    loading: overridesLoading,
    setWireOverride,
    setBaseOverride,
    clearWireOverride,
    clearBaseOverride,
  } = useCarOverrides(selectedCar || null);

  // Load capabilities from config
  useEffect(() => {
    if (config) {
      setCapabilities({ upscale_available: config.upscale_available || false });
    }
  }, [config]);

  // Restore selected car from session — only if the car still exists in the library
  useEffect(() => {
    if (!session?.last_car || selectedCar) return;
    // Wait until cars have loaded before validating
    if (cars.length === 0) return;
    const exists = cars.some((c) => c.folder === session.last_car);
    if (exists) {
      setSelectedCar(session.last_car);
    } else {
      logService.log(`[car] Saved car "${session.last_car}" no longer in library — clearing selection`);
    }
  }, [session, cars]);

  // If the currently selected car is removed from the library, clear the selection
  useEffect(() => {
    if (selectedCar && cars.length > 0) {
      const exists = cars.some((c) => c.folder === selectedCar);
      if (!exists) {
        logService.log(`[car] Selected car "${selectedCar}" no longer in library — clearing`);
        setSelectedCar('');
      }
    }
  }, [cars]);

  // Update car assets when selected car changes
  useEffect(() => {
    if (selectedCar) {
      const carObj = cars.find(c => c.folder === selectedCar);
      const slug = carObj?.slug || selectedCar;
      setCarWireUrl(getWireframeUrl(slug));
      setCarDiffuseUrl(getDiffuseUrl(slug));
      logService.log(`[car] Selected: ${selectedCar} (slug: ${slug})`);
    }
  }, [selectedCar, cars, getWireframeUrl, getDiffuseUrl]);

  // Load history on mount so spend total is available immediately
  useEffect(() => {
    loadHistory();
  }, []);

  // Reload history whenever the history tab is opened
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const handleCarChange = useCallback((folder) => {
    setSelectedCar(folder);
    saveSession({ last_car: folder });
  }, [saveSession]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    try { localStorage.setItem('lastActiveTab', tab); } catch {}
  }, []);

  const handleDeploy = useCallback(async (liveryPath, carName, customerId) => {
    const cid = customerId || config?.customer_id;
    await deploy(liveryPath, carName || selectedCar, cid);
  }, [deploy, config, selectedCar]);

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
    setActiveTab('generate');
    saveSession({
      base_texture_path: item.livery_path,
      last_mode: 'modify',
    });
  }, [saveSession]);

  const handleNavigateToHistory = useCallback((itemId) => {
    setActiveTab('history');
    // Store the target item ID so HistoryTab can focus on it
    try { sessionStorage.setItem('history-focus-id', itemId); } catch { /* ignore */ }
  }, []);

  // Sync spendFilter from config on load
  useEffect(() => {
    if (config?.spend_filter) setSpendFilter(config.spend_filter);
  }, [config?.spend_filter]);

  const handleSpendFilterChange = useCallback((f) => {
    setSpendFilter(f);
    saveConfig({ spend_filter: f });
  }, [saveConfig]);

  const handleEnhancePrompt = useCallback(async (prompt, context, mode) => {
    try {
      return await generateService.enhancePrompt(prompt, context, mode);
    } catch (e) {
      logService.log(`[enhance] Error: ${e.message}`);
      return null;
    }
  }, []);

  const totalSpend = getTotalSpend(spendFilter);

  // ── App loading splash ────────────────────────────────────────────────────
  if (configLoading || carsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bg-dark gap-5">
        <img src="/icon.png" alt="Livery AI Studio" width="72" height="72" className="rounded-xl mb-1" />
        <div className="text-[22px] font-bold text-text-primary tracking-tight">
          Livery <span className="text-accent-teal">A</span><span className="text-accent-wine">I</span> Studio
        </div>
        {/* Spinner */}
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
        totalSpend={totalSpend}
        spendFilter={spendFilter}
        onSpendingClick={() => setShowSpending(true)}
        historyLoading={historyLoading}
        theme={theme}
        onThemeChange={setTheme}
      />

      <SubBar
        selectedCar={selectedCar}
        cars={cars}
        onCarChange={handleCarChange}
        onClearIRacing={handleClearIRacing}
        onClearSpec={handleClearSpec}
        onDefaultLivery={handleDefaultLivery}
      />

      {/* Tab panels */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'generate' && (
          <GenerateTab
            selectedCar={selectedCar}
            carWireUrl={carWireUrl}
            carDiffuseUrl={carDiffuseUrl}
            generating={generating}
            lastResult={generateResult}
            generateStatus={generateStatus}
            onGenerate={generate}
            onClearStatus={clearGenerateStatus}
            onUploadFile={uploadFile}
            onBrowseUploads={browseUploads}
            onDeleteUpload={deleteUpload}
            session={session}
            onSaveSession={saveSession}
            config={config}
            onDeploy={handleDeploy}
            deploying={deploying}
            onOpenSamplePrompts={() => setShowSamplePrompts(true)}
            onOpenPromptHistory={() => setShowPromptHistory(true)}
            capabilities={capabilities}
            injectedPrompt={injectedPrompt}
            onInjectedPromptUsed={() => setInjectedPrompt(null)}
            onEnhancePrompt={handleEnhancePrompt}
            wireOverride={wireOverride}
            baseOverride={baseOverride}
            overridesLoading={overridesLoading}
            onSetWireOverride={setWireOverride}
            onSetBaseOverride={setBaseOverride}
            onClearWireOverride={clearWireOverride}
            onClearBaseOverride={clearBaseOverride}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab
            items={historyItems}
            loading={historyLoading}
            onLoad={loadHistory}
            onDelete={deleteHistory}
            onDeploy={handleDeploy}
            deploying={deploying}
            onIterateFrom={handleIterateFrom}
          />
        )}
        {activeTab === 'upscale' && (
          <UpscaleTab
            upscaling={upscaling}
            upscaleResult={upscaleResult}
            upscaleStatus={upscaleStatus}
            onUpscale={upscale}
            onClearStatus={clearUpscaleStatus}
            onDeploy={handleDeploy}
            deploying={deploying}
            config={config}
            capabilities={capabilities}
          />
        )}
        {/* CarsTab is always mounted so import progress survives tab switches */}
        <div className={activeTab === 'cars' ? 'h-full overflow-hidden' : 'hidden'}>
          <CarsTab
            cars={cars}
            selectedFolder={selectedCar}
            onSelectCar={handleCarChange}
            getWireframeUrl={getWireframeUrl}
            historyItems={historyItems}
            onNavigateToHistory={handleNavigateToHistory}
            starredCars={config?.starred_cars || []}
            onStarredChange={(folders) => saveConfig({ starred_cars: folders })}
          />
        </div>
        {activeTab === 'sponsors' && <SponsorsTab />}
        {activeTab === 'specular' && <SpecularTab />}
        {activeTab === 'settings' && (
          <SettingsTab
            config={config}
            onSaveConfig={saveConfig}
            loading={configLoading}
          />
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
