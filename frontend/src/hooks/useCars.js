import { useState, useEffect, useCallback } from 'react';
import carsService from '../services/CarsService';

/**
 * useCars — loads and exposes the list of available iRacing car templates.
 *
 * Fetches the car list from `CarsService` on mount and provides helpers for
 * building wireframe and diffuse image URLs.
 *
 * @returns {{
 *   cars: Array<{folder: string, display: string}>,
 *   loading: boolean,
 *   error: string|null,
 *   loadCars: () => Promise<Array>,
 *   getWireframeUrl: (slug: string) => string,
 *   getDiffuseUrl: (slug: string) => string,
 * }}
 */
export function useCars() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCars = useCallback(async () => {
    try {
      setLoading(true);
      const data = await carsService.getCars();
      setCars(data);
      setError(null);
      return data;
    } catch (e) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getWireframeUrl = useCallback((slug) => carsService.getWireframeUrl(slug), []);
  const getDiffuseUrl = useCallback((slug) => carsService.getDiffuseUrl(slug), []);

  useEffect(() => {
    loadCars();
  }, [loadCars]);

  return { cars, loading, error, loadCars, getWireframeUrl, getDiffuseUrl };
}
