import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeHtml, formatFileSize, getFilename, debounce, getStarredCars, saveStarredCars } from '../../utils/helpers';

describe('helpers utils', () => {
  describe('escapeHtml', () => {
    it('escapes < and > characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes & character', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('returns plain string unchanged', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });

  describe('getFilename', () => {
    it('extracts filename from Unix path', () => {
      expect(getFilename('/path/to/file.tga')).toBe('file.tga');
    });

    it('extracts filename from Windows path', () => {
      expect(getFilename('C:\\Users\\user\\file.tga')).toBe('file.tga');
    });

    it('returns empty string for empty input', () => {
      expect(getFilename('')).toBe('');
    });

    it('handles null/undefined gracefully', () => {
      expect(getFilename(null)).toBe('');
    });
  });

  describe('debounce', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('delays function execution', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1');
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith('arg1');
    });

    it('resets timer on multiple calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('first');
      vi.advanceTimersByTime(50);
      debounced('second');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('second');
    });
  });

  describe('starred cars localStorage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns empty set when no stars saved', () => {
      const result = getStarredCars();
      expect(result.size).toBe(0);
    });

    it('saves and retrieves starred cars', () => {
      const cars = new Set(['car1', 'car2']);
      saveStarredCars(cars);
      const result = getStarredCars();
      expect(result.has('car1')).toBe(true);
      expect(result.has('car2')).toBe(true);
    });
  });
});
