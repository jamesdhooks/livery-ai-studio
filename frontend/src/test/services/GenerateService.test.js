import { describe, it, expect, vi, beforeEach } from 'vitest';
import generateService from '../../services/GenerateService';

describe('GenerateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a singleton instance', () => {
    return import('../../services/GenerateService').then((m) => {
      expect(m.default).toBe(generateService);
    });
  });

  it('generate calls POST /generate with params', async () => {
    const params = { model: 'flash', car_folder: 'porsche992rgt3', prompt: 'Gulf livery' };
    const mockResult = { livery_path: '/data/liveries/123.tga' };
    generateService.post = vi.fn().mockResolvedValueOnce(mockResult);

    const result = await generateService.generate(params);
    expect(generateService.post).toHaveBeenCalledWith('/generate', params);
    expect(result).toEqual(mockResult);
  });

  it('uploadFile sends FormData to POST /upload-file', async () => {
    const mockResult = { path: '/data/generate/wire/image.png' };
    generateService.post = vi.fn().mockResolvedValueOnce(mockResult);

    const file = new File(['content'], 'wire.png', { type: 'image/png' });
    const result = await generateService.uploadFile('wire', file);

    expect(generateService.post).toHaveBeenCalledWith(
      '/upload-file',
      expect.any(FormData)
    );
    expect(result).toEqual(mockResult);
  });

  it('uploadFile appends file, category, and car metadata to FormData', async () => {
    generateService.post = vi.fn().mockResolvedValueOnce({});
    const file = new File(['data'], 'base.png', { type: 'image/png' });
    await generateService.uploadFile('base', file, { car_folder: 'porsche992', car_display: 'Porsche 911' });

    const formData = generateService.post.mock.calls[0][1];
    expect(formData.get('file')).toBe(file);
    expect(formData.get('category')).toBe('base');
    expect(formData.get('car_folder')).toBe('porsche992');
    expect(formData.get('car_display')).toBe('Porsche 911');
  });

  it('getUploads calls GET /uploads/{category}', async () => {
    const mockList = [{ name: 'wire.png', path: '/data/generate/wire/wire.png' }];
    generateService.get = vi.fn().mockResolvedValueOnce(mockList);

    const result = await generateService.getUploads('wire');
    expect(generateService.get).toHaveBeenCalledWith('/uploads/wire');
    expect(result).toEqual(mockList);
  });
});
