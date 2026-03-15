import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHistory } from '../../hooks/useHistory';
import historyService from '../../services/HistoryService';

vi.mock('../../services/HistoryService', () => ({
  default: {
    getHistory: vi.fn(),
    deleteHistory: vi.fn(),
  },
}));

describe('useHistory hook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('starts with empty items', () => {
    historyService.getHistory.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toEqual([]);
  });

  it('loads history when loadHistory is called', async () => {
    const mockItems = [
      { id: '1', car_folder: 'porsche992rgt3', cost: 0.067, prompt: 'Test prompt' },
    ];
    historyService.getHistory.mockResolvedValueOnce(mockItems);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('1');
    expect(result.current.items[0].cost).toBe(0.067);
    expect(result.current.items[0].prompt).toBe('Test prompt');
    expect(result.current.items[0].display_name).toBe('porsche992rgt3');
  });

  it('removes item on delete', async () => {
    const mockItems = [
      { id: '1', car_folder: 'porsche992rgt3', cost: 0.067 },
      { id: '2', car_folder: 'ferrari488gte', cost: 0.134 },
    ];
    historyService.getHistory.mockResolvedValueOnce(mockItems);
    historyService.deleteHistory.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    await act(async () => {
      await result.current.deleteItem('1');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('2');
  });

  it('calculates total spend correctly', async () => {
    const mockItems = [
      { id: '1', cost: 0.067 },
      { id: '2', cost: 0.134 },
    ];
    historyService.getHistory.mockResolvedValueOnce(mockItems);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadHistory();
    });

    expect(result.current.getTotalSpend()).toBeCloseTo(0.201);
  });
});
