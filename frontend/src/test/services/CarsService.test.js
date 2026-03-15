import { describe, it, expect, vi, beforeEach } from 'vitest';
import carsService from '../../services/CarsService';

describe('CarsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a singleton instance', () => {
    return import('../../services/CarsService').then((m) => {
      expect(m.default).toBe(carsService);
    });
  });

  it('getCars calls GET /cars', async () => {
    const mockCars = [{ folder: 'porsche992rgt3', display: 'Porsche 911 GT3 R (992)' }];
    carsService.get = vi.fn().mockResolvedValueOnce(mockCars);
    const result = await carsService.getCars();
    expect(carsService.get).toHaveBeenCalledWith('/cars');
    expect(result).toEqual(mockCars);
  });

  it('getWireframeUrl returns correct URL', () => {
    expect(carsService.getWireframeUrl('porsche992rgt3'))
      .toBe('/api/library/image/porsche992rgt3/wire.jpg');
  });

  it('getDiffuseUrl returns correct URL', () => {
    expect(carsService.getDiffuseUrl('ferrari488gte'))
      .toBe('/api/library/image/ferrari488gte/diffuse.jpg');
  });

  it('getWireframeUrl and getDiffuseUrl use different endpoints', () => {
    const slug = 'bmwm4gt3';
    expect(carsService.getWireframeUrl(slug)).toContain('wire.jpg');
    expect(carsService.getDiffuseUrl(slug)).toContain('diffuse.jpg');
  });
});
