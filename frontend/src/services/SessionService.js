import { BaseService } from './BaseService';

/**
 * SessionService — persists transient UI state across page reloads.
 *
 * Session data (last selected car, last prompt, tab position, etc.) is stored
 * server-side in `config.json` under a `session` key and is loaded on startup.
 * This keeps the form pre-filled even if the user closes and reopens the app.
 */
class SessionService extends BaseService {
  constructor() {
    super('/api');
  }

  /**
   * Load the last saved session state.
   * @returns {Promise<Object>} The session object (keys mirror form fields).
   */
  async getSession() {
    return this.get('/session');
  }

  /**
   * Save (partial or full) session state.
   * @param {Object} data - Key/value pairs to persist.
   * @returns {Promise<{ok: boolean}>}
   */
  async saveSession(data) {
    return this.post('/session', data);
  }
}

export default new SessionService();
