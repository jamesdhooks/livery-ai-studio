import { BaseService } from './BaseService';

/**
 * LogService — fire-and-forget client-side log forwarding.
 *
 * Sends log messages to the Flask backend so they appear in the terminal
 * alongside Python-level logs.  Errors are silently swallowed so a broken
 * log endpoint never disrupts normal app operation.
 */
class LogService extends BaseService {
  constructor() {
    super('/api');
  }

  /**
   * Send a log message to the backend.  Any network or server error is
   * silently ignored — logging must never crash the calling code.
   * @param {string} msg - The message to log.
   * @returns {Promise<void>}
   */
  async log(msg) {
    try {
      await this.post('/log', { msg });
    } catch {
      // Don't let logging errors break the app
    }
  }
}

export default new LogService();
