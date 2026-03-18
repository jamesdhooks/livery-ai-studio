import { describe, it, expect, vi, beforeEach } from 'vitest';
import upscaleService from '../../services/UpscaleService';

describe('UpscaleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a singleton instance', () => {
    return import('../../services/UpscaleService').then((m) => {
      expect(m.default).toBe(upscaleService);
    });
  });

  it('upscale calls POST /upscale with path', async () => {
    const mockResult = { output_path: '/data/liveries/123_4x.tga' };
    upscaleService.post = vi.fn().mockResolvedValueOnce(mockResult);

    const result = await upscaleService.upscale('/data/liveries/123.tga');
    expect(upscaleService.post).toHaveBeenCalledWith('/upscale', {
      path: '/data/liveries/123.tga',
    });
    expect(result).toEqual(mockResult);
  });

  it('deploy calls POST /deploy with correct payload', async () => {
    upscaleService.post = vi.fn().mockResolvedValueOnce({ ok: true });

    const result = await upscaleService.deploy('/data/liveries/123.tga', 'porsche992rgt3', '123456');
    expect(upscaleService.post).toHaveBeenCalledWith('/deploy', {
      path: '/data/liveries/123.tga',
      car_folder: 'porsche992rgt3',
      customer_id: '123456',
    });
    expect(result).toEqual({ ok: true });
  });

  it('deploy includes all three required fields', async () => {
    upscaleService.post = vi.fn().mockResolvedValueOnce({ ok: true });
    await upscaleService.deploy('/path/livery.tga', 'bmwm4gt3', '999');
    const payload = upscaleService.post.mock.calls[0][1];
    expect(payload).toHaveProperty('path');
    expect(payload).toHaveProperty('car_folder');
    expect(payload).toHaveProperty('customer_id');
  });
});
