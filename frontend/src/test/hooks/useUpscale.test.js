import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUpscale } from '../../hooks/useUpscale';
import upscaleService from '../../services/UpscaleService';

vi.mock('../../services/UpscaleService', () => ({
  default: {
    upscale: vi.fn(),
    deploy: vi.fn(),
  },
}));

describe('useUpscale hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with all states false/null', () => {
    const { result } = renderHook(() => useUpscale());
    expect(result.current.upscaling).toBe(false);
    expect(result.current.deploying).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBeNull();
  });

  it('sets upscaling=true while upscale request is in flight', async () => {
    let resolveUpscale;
    upscaleService.upscale.mockReturnValueOnce(
      new Promise((resolve) => { resolveUpscale = resolve; })
    );

    const { result } = renderHook(() => useUpscale());

    act(() => {
      result.current.upscale('/data/liveries/123.tga');
    });

    expect(result.current.upscaling).toBe(true);

    await act(async () => {
      resolveUpscale({ output_path: '/data/liveries/123_4x.tga' });
    });

    expect(result.current.upscaling).toBe(false);
  });

  it('sets result and success status on successful upscale', async () => {
    const mockData = { output_path: '/data/liveries/123_4x.tga' };
    upscaleService.upscale.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useUpscale());

    await act(async () => {
      await result.current.upscale('/data/liveries/123.tga');
    });

    expect(result.current.result).toEqual(mockData);
    expect(result.current.status.type).toBe('success');
    expect(result.current.error).toBeNull();
  });

  it('sets error and error status on upscale failure', async () => {
    upscaleService.upscale.mockRejectedValueOnce(new Error('CUDA out of memory'));

    const { result } = renderHook(() => useUpscale());

    await act(async () => {
      await result.current.upscale('/data/liveries/123.tga');
    });

    expect(result.current.error).toBe('CUDA out of memory');
    expect(result.current.status.type).toBe('error');
  });

  it('ignores duplicate upscale calls while upscaling', async () => {
    let resolveFirst;
    upscaleService.upscale.mockReturnValueOnce(
      new Promise((resolve) => { resolveFirst = resolve; })
    );

    const { result } = renderHook(() => useUpscale());

    act(() => { result.current.upscale('/data/liveries/a.tga'); });
    expect(result.current.upscaling).toBe(true);

    let secondResult;
    await act(async () => {
      secondResult = await result.current.upscale('/data/liveries/b.tga');
    });

    expect(secondResult).toBeNull();
    expect(upscaleService.upscale).toHaveBeenCalledTimes(1);

    await act(async () => { resolveFirst({ output_path: '/out.tga' }); });
  });

  it('sets deploying=true while deploy request is in flight', async () => {
    let resolveDeploy;
    upscaleService.deploy.mockReturnValueOnce(
      new Promise((resolve) => { resolveDeploy = resolve; })
    );

    const { result } = renderHook(() => useUpscale());

    act(() => {
      result.current.deploy('/data/liveries/123.tga', 'porsche992rgt3', '123456');
    });

    expect(result.current.deploying).toBe(true);

    await act(async () => { resolveDeploy({ ok: true }); });

    expect(result.current.deploying).toBe(false);
  });

  it('returns true and success status on successful deploy', async () => {
    upscaleService.deploy.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useUpscale());

    let deployResult;
    await act(async () => {
      deployResult = await result.current.deploy('/data/liveries/123.tga', 'porsche992rgt3', '123456');
    });

    expect(deployResult).toBe(true);
    expect(result.current.status.type).toBe('success');
  });

  it('returns false and error status on deploy failure', async () => {
    upscaleService.deploy.mockRejectedValueOnce(new Error('iRacing not found'));

    const { result } = renderHook(() => useUpscale());

    let deployResult;
    await act(async () => {
      deployResult = await result.current.deploy('/data/liveries/123.tga', 'porsche992rgt3', '123456');
    });

    expect(deployResult).toBe(false);
    expect(result.current.error).toBe('iRacing not found');
  });

  it('clearStatus resets status to null', async () => {
    upscaleService.upscale.mockResolvedValueOnce({ output_path: '/out.tga' });

    const { result } = renderHook(() => useUpscale());

    await act(async () => { await result.current.upscale('/data/liveries/123.tga'); });
    expect(result.current.status).not.toBeNull();

    act(() => { result.current.clearStatus(); });
    expect(result.current.status).toBeNull();
  });
});
