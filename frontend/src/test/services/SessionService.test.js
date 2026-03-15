import { describe, it, expect, vi, beforeEach } from 'vitest';
import sessionService from '../../services/SessionService';

describe('SessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a singleton instance', () => {
    return import('../../services/SessionService').then((m) => {
      expect(m.default).toBe(sessionService);
    });
  });

  it('getSession calls GET /session', async () => {
    const mockSession = { last_car: 'porsche992rgt3', last_prompt: 'Gulf livery' };
    sessionService.get = vi.fn().mockResolvedValueOnce(mockSession);

    const result = await sessionService.getSession();
    expect(sessionService.get).toHaveBeenCalledWith('/session');
    expect(result).toEqual(mockSession);
  });

  it('saveSession calls POST /session with data', async () => {
    sessionService.post = vi.fn().mockResolvedValueOnce({ ok: true });
    const data = { last_car: 'ferrari488gte', last_prompt: 'Red livery' };

    const result = await sessionService.saveSession(data);
    expect(sessionService.post).toHaveBeenCalledWith('/session', data);
    expect(result).toEqual({ ok: true });
  });
});
