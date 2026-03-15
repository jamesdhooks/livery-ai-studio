import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseService } from '../../services/BaseService';

describe('BaseService', () => {
  let service;

  beforeEach(() => {
    service = new BaseService('/api');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs with base path', () => {
    expect(service.basePath).toBe('/api');
  });

  it('_url appends path to basePath', () => {
    expect(service._url('/config')).toBe('/api/config');
  });

  it('get() calls fetch with GET method', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: 'test' }),
    });

    const result = await service.get('/config');
    expect(global.fetch).toHaveBeenCalledWith('/api/config', expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual({ data: 'test' });
  });

  it('post() calls fetch with POST method and JSON body', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
    });

    const body = { key: 'value' };
    await service.post('/config', body);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/config',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
    );
  });

  it('throws error on non-ok response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'Resource not found' }),
    });

    await expect(service.get('/missing')).rejects.toThrow('Resource not found');
  });

  it('delete() calls fetch with DELETE method', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
    });

    await service.delete('/history/123');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/history/123',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('sends FormData without Content-Type header', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ path: '/tmp/file.jpg' }),
    });

    const formData = new FormData();
    await service.post('/upload', formData);

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.body).toBe(formData);
  });
});
