import { describe, it, expect } from 'vitest';
import { calculateCost, formatCost, getModelDisplayName, getResolutionDisplayName, DEFAULT_PRICING } from '../../utils/pricing';

describe('pricing utils', () => {
  describe('calculateCost', () => {
    it('returns pro price for pro model', () => {
      expect(calculateCost('pro')).toBe(DEFAULT_PRICING.pro);
    });

    it('returns flash_1k price for flash without 2K', () => {
      expect(calculateCost('flash', false)).toBe(DEFAULT_PRICING.flash_1k);
    });

    it('returns flash_2k price for flash with 2K', () => {
      expect(calculateCost('flash', true)).toBe(DEFAULT_PRICING.flash_2k);
    });

    it('uses pricing overrides when provided', () => {
      const overrides = { pro: 0.200 };
      expect(calculateCost('pro', false, overrides)).toBe(0.200);
    });

    it('merges overrides with defaults', () => {
      const overrides = { pro: 0.200 };
      expect(calculateCost('flash', false, overrides)).toBe(DEFAULT_PRICING.flash_1k);
    });
  });

  describe('formatCost', () => {
    it('formats cost to 2 decimal places', () => {
      expect(formatCost(0.067)).toBe('$0.07');
    });

    it('pads to 2 decimal places', () => {
      expect(formatCost(0.1)).toBe('$0.10');
    });

    it('handles zero', () => {
      expect(formatCost(0)).toBe('$0.00');
    });
  });

  describe('getModelDisplayName', () => {
    it('returns pro display name', () => {
      expect(getModelDisplayName('pro')).toContain('Pro');
    });

    it('returns flash display name', () => {
      expect(getModelDisplayName('flash')).toContain('Flash');
    });
  });

  describe('getResolutionDisplayName', () => {
    it('returns dash for pro model', () => {
      expect(getResolutionDisplayName('pro')).toBe('—');
    });

    it('returns 1K for flash without 2K', () => {
      expect(getResolutionDisplayName('flash', false)).toContain('1K');
    });

    it('returns 2K for flash with 2K', () => {
      expect(getResolutionDisplayName('flash', true)).toContain('2K');
    });
  });
});
