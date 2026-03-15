import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCars } from '../../hooks/useCars';
import carsService from '../../services/CarsService';

vi.mock('../../services/CarsService', () => ({
  default: {
    getCars: vi.fn(),
    getWireframeUrl: vi.fn((slug) => `/api/library/image/${slug}/wire.jpg`),
    getDiffuseUrl: vi.fn((slug) => `/api/library/image/${slug}/diffuse.jpg`),
  },
}));

describe('useCars hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads cars on mount', async () => {
    const mockCars = [
      { folder: 'porsche992rgt3', display: 'Porsche 911 GT3 R (992)' },
      { folder: 'ferrari488gte', display: 'Ferrari 488 GTE' },
    ];
    carsService.getCars.mockResolvedValueOnce(mockCars);

    const { result } = renderHook(() => useCars());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.cars).toEqual(mockCars);
  });

  it('returns correct wireframe URL', async () => {
    carsService.getCars.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useCars());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const url = result.current.getWireframeUrl('porsche992rgt3');
    expect(url).toBe('/api/library/image/porsche992rgt3/wire.jpg');
  });
});
