import { BaseService } from './BaseService';

/**
 * HistoryService — retrieves and deletes past livery generations.
 *
 * History records are persisted server-side under `data/liveries/` and
 * surfaced through the `/api/history` endpoint.
 */
class HistoryService extends BaseService {
  constructor() {
    super('/api');
  }

  /**
   * Fetch the full list of past generations, newest first.
   * @returns {Promise<Array<{id: string, car_folder: string, prompt: string, cost: number, livery_path: string}>>}
   */
  async getHistory() {
    return this.get('/history');
  }

  /**
   * Permanently delete a history record and its associated files.
   * @param {string} id - History entry ID.
   * @returns {Promise<{ok: boolean}>}
   */
  async deleteHistory(id) {
    return this.delete(`/history/${id}`);
  }
}

export default new HistoryService();
