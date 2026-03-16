import { BaseService } from './BaseService';

/**
 * SpendingService — persistent spending log API
 *
 * The backend records every transaction (success / failed / cancelled)
 * in data/spending_log.json, independent of the TGA history files.
 * This means totals are accurate even after deleting history items or
 * when generations fail mid-request.
 */
class SpendingService extends BaseService {
  constructor() {
    super('/api');
  }

  /** Fetch all spending log entries, newest first. */
  async getEntries() {
    return this.get('/spending');
  }

  /**
   * Record a failed or cancelled transaction from the frontend.
   * @param {{ cost: number, model: string, resolution: string, status: string, car: string }} params
   */
  async recordTransaction({ cost, model, resolution, status, car }) {
    return this.post('/spending/record', { cost, model, resolution, status, car });
  }
}

export default new SpendingService();
