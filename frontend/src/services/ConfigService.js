import { BaseService } from './BaseService';

/**
 * ConfigService — manages application configuration via the Flask `/api/config` endpoint.
 *
 * Stores and retrieves persistent settings (API key, customer ID, pricing overrides, etc.)
 * that are saved server-side in `config.json`.
 */
class ConfigService extends BaseService {
  constructor() {
    super('/api');
  }

  /**
   * Fetch the current application configuration.
   * @returns {Promise<Object>} The config object from `config.json`.
   */
  async getConfig() {
    return this.get('/config');
  }

  /**
   * Persist an updated configuration object.
   * @param {Object} config - Full or partial config to save.
   * @returns {Promise<Object>} Server confirmation.
   */
  async saveConfig(config) {
    return this.post('/config', config);
  }

  /**
   * Wipe all generated data (liveries, uploads, history, session state).
   * Preserves config.json (API key, customer ID, pricing).
   * @param {string} confirmation - Must be exactly "wipe my data".
   * @returns {Promise<Object>} Server confirmation with list of deleted paths.
   */
  async wipeData(confirmation) {
    return this.post('/wipe-data', { confirmation });
  }
}

export default new ConfigService();
