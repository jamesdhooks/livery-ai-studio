import { describe, it, expect, vi, beforeEach } from 'vitest';
import configService from '../../services/ConfigService';

describe('ConfigService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('is a singleton instance', () => {
    return import('../../services/ConfigService').then((m) => {
      expect(m.default).toBe(configService);
    });
  });

  it('getConfig calls GET /config', async () => {
    vi.spyOn(configService, 'get').mockResolvedValueOnce({ gemini_api_key: 'key' });
    const result = await configService.getConfig();
    expect(configService.get).toHaveBeenCalledWith('/config');
    expect(result).toEqual({ gemini_api_key: 'key' });
  });

  it('saveConfig calls POST /config with payload', async () => {
    vi.spyOn(configService, 'post').mockResolvedValueOnce({ ok: true });
    const payload = { gemini_api_key: 'abc', customer_id: '99' };
    const result = await configService.saveConfig(payload);
    expect(configService.post).toHaveBeenCalledWith('/config', payload);
    expect(result).toEqual({ ok: true });
  });
});

