import { describe, it, expect, vi, beforeEach } from 'vitest';
import logService from '../../services/LogService';

describe('LogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a singleton instance', () => {
    return import('../../services/LogService').then((m) => {
      expect(m.default).toBe(logService);
    });
  });

  it('log calls POST /log with msg', async () => {
    logService.post = vi.fn().mockResolvedValueOnce({ ok: true });
    await logService.log('Test message');
    expect(logService.post).toHaveBeenCalledWith('/log', { msg: 'Test message' });
  });

  it('does not throw when POST /log fails', async () => {
    logService.post = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    await expect(logService.log('any message')).resolves.toBeUndefined();
  });

  it('silently swallows errors to avoid breaking the app', async () => {
    logService.post = vi.fn().mockRejectedValueOnce(new Error('500 Internal Server Error'));
    // Should not throw — logging failures must never crash the app
    await expect(logService.log('crash?')).resolves.not.toThrow();
  });
});
