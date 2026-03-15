import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConfig } from '../../hooks/useConfig';
import configService from '../../services/ConfigService';

vi.mock('../../services/ConfigService', () => ({
  default: {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
  },
}));

describe('useConfig hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads config on mount', async () => {
    const mockConfig = { gemini_api_key: 'test', customer_id: '123' };
    configService.getConfig.mockResolvedValueOnce(mockConfig);

    const { result } = renderHook(() => useConfig());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.config).toEqual(mockConfig);
  });

  it('sets error on load failure', async () => {
    configService.getConfig.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('saves config and merges with existing', async () => {
    const mockConfig = { gemini_api_key: 'test', customer_id: '123' };
    const updatedConfig = { gemini_api_key: 'test', customer_id: '456' };
    // First call: initial load. Second call: reload after save.
    configService.getConfig
      .mockResolvedValueOnce(mockConfig)
      .mockResolvedValueOnce(updatedConfig);
    configService.saveConfig.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useConfig());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveConfig({ customer_id: '456' });
    });

    await waitFor(() => expect(result.current.config?.customer_id).toBe('456'));
    expect(result.current.config.gemini_api_key).toBe('test');
  });
});
