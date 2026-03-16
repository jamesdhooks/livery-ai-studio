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

  /**
   * Update fields on a history sidecar JSON.
   * @param {string} path - Absolute path to the TGA file.
   * @param {Object} updates - Fields to update (e.g. { car_folder, car }).
   * @returns {Promise<{status: string, updated: Object}>}
   */
  async updateItem(path, updates) {
    return this.post('/history/update', { path, updates });
  }
}

export default new HistoryService();
