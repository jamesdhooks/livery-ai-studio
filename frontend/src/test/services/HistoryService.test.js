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

  it('deleteHistory calls POST /history/delete with path', async () => {
    historyService.post = vi.fn().mockResolvedValueOnce({ ok: true });

    const result = await historyService.deleteHistory('/data/liveries/abc-123.tga');
    expect(historyService.post).toHaveBeenCalledWith('/history/delete', { path: '/data/liveries/abc-123.tga' });
    expect(result).toEqual({ ok: true });
  });

  it('deleteHistory uses the provided path in the request', async () => {
    historyService.post = vi.fn().mockResolvedValueOnce({ ok: true });
    await historyService.deleteHistory('/data/liveries/xyz-789.tga');
    expect(historyService.post).toHaveBeenCalledWith('/history/delete', { path: '/data/liveries/xyz-789.tga' });
  });
});
