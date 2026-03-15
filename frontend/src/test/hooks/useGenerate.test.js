import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGenerate } from '../../hooks/useGenerate';
import generateService from '../../services/GenerateService';
import logService from '../../services/LogService';

vi.mock('../../services/GenerateService', () => ({
  default: {
    generate: vi.fn(),
    uploadFile: vi.fn(),
    getUploads: vi.fn(),
  },
}));

vi.mock('../../services/LogService', () => ({
  default: { log: vi.fn() },
}));

describe('useGenerate hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with generating=false and no result', () => {
    const { result } = renderHook(() => useGenerate());
    expect(result.current.generating).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBeNull();
  });

  it('sets generating=true while request is in flight', async () => {
    let resolveGenerate;
    generateService.generate.mockReturnValueOnce(
      new Promise((resolve) => { resolveGenerate = resolve; })
    );

    const { result } = renderHook(() => useGenerate());

    act(() => {
      result.current.generate({ model: 'flash', car_folder: 'porsche992rgt3' });
    });

    expect(result.current.generating).toBe(true);

    await act(async () => {
      resolveGenerate({ livery_path: '/tmp/out.tga' });
    });

    expect(result.current.generating).toBe(false);
  });

  it('sets result and success status on successful generation', async () => {
    const mockData = { livery_path: '/data/liveries/abc.tga' };
    generateService.generate.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useGenerate());

    await act(async () => {
      await result.current.generate({ model: 'pro', car_folder: 'ferrari488gte' });
    });

    expect(result.current.result).toEqual(mockData);
    expect(result.current.status.type).toBe('success');
    expect(result.current.error).toBeNull();
  });

  it('sets error and error status on failure', async () => {
    generateService.generate.mockRejectedValueOnce(new Error('API limit reached'));

    const { result } = renderHook(() => useGenerate());

    await act(async () => {
      await result.current.generate({ model: 'flash', car_folder: 'porsche992rgt3' });
    });

    expect(result.current.error).toBe('API limit reached');
    expect(result.current.status.type).toBe('error');
    expect(result.current.result).toBeNull();
  });

  it('ignores duplicate generate calls while generating', async () => {
    let resolveFirst;
    generateService.generate.mockReturnValueOnce(
      new Promise((resolve) => { resolveFirst = resolve; })
    );

    const { result } = renderHook(() => useGenerate());

    act(() => {
      result.current.generate({ model: 'flash', car_folder: 'porsche992rgt3' });
    });

    expect(result.current.generating).toBe(true);

    // Second call while first is in-flight — should return null immediately
    let secondResult;
    await act(async () => {
      secondResult = await result.current.generate({ model: 'flash', car_folder: 'porsche992rgt3' });
    });

    expect(secondResult).toBeNull();
    expect(generateService.generate).toHaveBeenCalledTimes(1);

    await act(async () => { resolveFirst({ livery_path: '/tmp/out.tga' }); });
  });

  it('uploadFile returns data on success', async () => {
    const mockData = { path: '/data/generate/wire/foo.png' };
    generateService.uploadFile.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useGenerate());
    const file = new File(['x'], 'wire.png');

    let data;
    await act(async () => {
      data = await result.current.uploadFile('wire', file);
    });

    expect(data).toEqual(mockData);
    expect(generateService.uploadFile).toHaveBeenCalledWith('wire', file, {});
  });

  it('uploadFile returns null and sets error on failure', async () => {
    generateService.uploadFile.mockRejectedValueOnce(new Error('File too large'));

    const { result } = renderHook(() => useGenerate());

    let data;
    await act(async () => {
      data = await result.current.uploadFile('wire', new File(['x'], 'wire.png'));
    });

    expect(data).toBeNull();
    expect(result.current.error).toBe('File too large');
  });

  it('getUploads returns list on success', async () => {
    const mockList = [{ name: 'wire.png' }];
    generateService.getUploads.mockResolvedValueOnce(mockList);

    const { result } = renderHook(() => useGenerate());

    let list;
    await act(async () => {
      list = await result.current.getUploads('wire');
    });

    expect(list).toEqual(mockList);
  });

  it('getUploads returns empty array on failure', async () => {
    generateService.getUploads.mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => useGenerate());

    let list;
    await act(async () => {
      list = await result.current.getUploads('wire');
    });

    expect(list).toEqual([]);
  });

  it('clearStatus resets status to null', async () => {
    generateService.generate.mockResolvedValueOnce({ livery_path: '/tmp/out.tga' });

    const { result } = renderHook(() => useGenerate());

    await act(async () => {
      await result.current.generate({ model: 'flash', car_folder: 'porsche992rgt3' });
    });

    expect(result.current.status).not.toBeNull();

    act(() => { result.current.clearStatus(); });

    expect(result.current.status).toBeNull();
  });

  it('clearError resets error to null', async () => {
    generateService.generate.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useGenerate());

    await act(async () => {
      await result.current.generate({ model: 'flash', car_folder: 'porsche992rgt3' });
    });

    expect(result.current.error).not.toBeNull();

    act(() => { result.current.clearError(); });

    expect(result.current.error).toBeNull();
  });
});
