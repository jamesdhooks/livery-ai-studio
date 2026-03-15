import { describe, it, expect, vi, beforeEach } from 'vitest';
import historyService from '../../services/HistoryService';

describe('HistoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a singleton instance', () => {
    return import('../../services/HistoryService').then((m) => {
      expect(m.default).toBe(historyService);
    });
  });

  it('getHistory calls GET /history', async () => {
    const mockItems = [{ id: '1', car_folder: 'porsche992rgt3', cost: 0.067 }];
    historyService.get = vi.fn().mockResolvedValueOnce(mockItems);

    const result = await historyService.getHistory();
    expect(historyService.get).toHaveBeenCalledWith('/history');
    expect(result).toEqual(mockItems);
  });

  it('deleteHistory calls DELETE /history/{id}', async () => {
    historyService.delete = vi.fn().mockResolvedValueOnce({ ok: true });

    const result = await historyService.deleteHistory('abc-123');
    expect(historyService.delete).toHaveBeenCalledWith('/history/abc-123');
    expect(result).toEqual({ ok: true });
  });

  it('deleteHistory uses the provided id in the path', async () => {
    historyService.delete = vi.fn().mockResolvedValueOnce({ ok: true });
    await historyService.deleteHistory('xyz-789');
    expect(historyService.delete).toHaveBeenCalledWith('/history/xyz-789');
  });
});
