import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useCars } from '../hooks/useCars';
import { useCarOverrides } from '../hooks/useCarOverrides';
import { useSessionContext } from './SessionContext';
import logService from '../services/LogService';

const CarsContext = createContext(null);

/**
 * CarsProvider — wraps the app and provides car selection + override state.
 *
 * Manages: car list, selected car, car asset URLs (wire/diffuse),
 * per-car wireframe/base overrides.
 */
export function CarsProvider({ children }) {
  const { session, saveSession } = useSessionContext();
  const { cars, loading: carsLoading, error, getWireframeUrl, getDiffuseUrl } = useCars();

  const [selectedCar, setSelectedCarRaw] = useState('');
  const restoredCarRef = useRef(false);

  // Restore car from session once cars are loaded
  useEffect(() => {
    if (restoredCarRef.current || !session?.last_car || cars.length === 0 || selectedCar) return;
    restoredCarRef.current = true;
    const exists = cars.some((c) => c.folder === session.last_car);
    if (exists) {
      setSelectedCarRaw(session.last_car);
    } else {
      logService.log(`[car] Saved car "${session.last_car}" no longer in library — clearing selection`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, cars]);

  // Validate that selected car still exists when car list changes
  useEffect(() => {
    if (selectedCar && cars.length > 0 && !cars.some((c) => c.folder === selectedCar)) {
      logService.log(`[car] Selected car "${selectedCar}" no longer in library — clearing`);
      setSelectedCarRaw('');
    }
     
  }, [cars, selectedCar]);

  const {
    wireOverride,
    baseOverride,
    loading: overridesLoading,
    setWireOverride,
    setBaseOverride,
    clearWireOverride,
    clearBaseOverride,
  } = useCarOverrides(selectedCar || null);

  // Derive car asset URLs from selection (no effect needed)
  const { carWireUrl, carDiffuseUrl } = useMemo(() => {
    if (!selectedCar) return { carWireUrl: '', carDiffuseUrl: '' };
    const carObj = cars.find(c => c.folder === selectedCar);
    const slug = carObj?.slug || selectedCar;
    return {
      carWireUrl: getWireframeUrl(slug),
      carDiffuseUrl: getDiffuseUrl(slug),
    };
  }, [selectedCar, cars, getWireframeUrl, getDiffuseUrl]);

  const handleCarChange = useCallback((folder) => {
    setSelectedCarRaw(folder);
    saveSession({ last_car: folder });
  }, [saveSession]);

  const value = {
    cars,
    carsLoading,
    error,
    selectedCar,
    setSelectedCar: setSelectedCarRaw,
    onCarChange: handleCarChange,
    carWireUrl,
    carDiffuseUrl,
    getWireframeUrl,
    getDiffuseUrl,
    // Overrides
    wireOverride,
    baseOverride,
    overridesLoading,
    setWireOverride,
    setBaseOverride,
    clearWireOverride,
    clearBaseOverride,
  };

  return (
    <CarsContext.Provider value={value}>
      {children}
    </CarsContext.Provider>
  );
}

/**
 * useCarsContext — returns the full car state:
 *   { cars, carsLoading, selectedCar, setSelectedCar, onCarChange,
 *     carWireUrl, carDiffuseUrl, getWireframeUrl, getDiffuseUrl,
 *     wireOverride, baseOverride, overridesLoading,
 *     setWireOverride, setBaseOverride, clearWireOverride, clearBaseOverride }
 */
export function useCarsContext() {
  const ctx = useContext(CarsContext);
  if (!ctx) throw new Error('useCarsContext must be used inside <CarsProvider>');
  return ctx;
}
