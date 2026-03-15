/**
 * Pricing utilities for Gemini API cost calculations.
 */

export const DEFAULT_PRICING = {
  flash_1k: 0.067,
  flash_2k: 0.101,
  pro: 0.134,
};

/**
 * Calculate the cost for a generation based on model and resolution.
 * @param {string} model - 'flash' or 'pro'
 * @param {boolean} is2K - Whether 2K resolution is selected (flash only)
 * @param {Object} pricingOverrides - Optional pricing overrides from config
 * @returns {number} Cost in USD
 */
export function calculateCost(model, is2K = false, pricingOverrides = {}) {
  const pricing = { ...DEFAULT_PRICING, ...pricingOverrides };
  
  if (model === 'pro') {
    return pricing.pro;
  }
  
  // Flash model
  return is2K ? pricing.flash_2k : pricing.flash_1k;
}

/**
 * Format a cost value as a dollar string.
 * @param {number} cost
 * @returns {string}
 */
export function formatCost(cost) {
  return `$${cost.toFixed(2)}`;
}

/**
 * Get model display name.
 * @param {string} model - 'flash' or 'pro'
 * @param {boolean} is2K
 * @param {Object} pricingOverrides
 * @returns {string}
 */
export function getModelDisplayName(model, is2K = false, pricingOverrides = {}) {
  const pricing = { ...DEFAULT_PRICING, ...pricingOverrides };
  
  if (model === 'pro') {
    return `Pro ($${pricing.pro})`;
  }
  
  return `Flash ($${pricing.flash_1k}–$${pricing.flash_2k})`;
}

/**
 * Get resolution display name.
 * @param {string} model
 * @param {boolean} is2K
 * @param {Object} pricingOverrides
 * @returns {string}
 */
export function getResolutionDisplayName(model, is2K = false, pricingOverrides = {}) {
  const pricing = { ...DEFAULT_PRICING, ...pricingOverrides };
  
  if (model === 'pro') return '—';
  
  return is2K ? `2K ($${pricing.flash_2k})` : `1K ($${pricing.flash_1k})`;
}
