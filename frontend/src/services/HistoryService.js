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
   * Move a history record to trash (soft delete).
   * @param {string} path - Absolute path to the TGA file.
   * @returns {Promise<{status: string}>}
   */
  async deleteHistory(path) {
    return this.post('/history/delete', { path });
  }

  /**
   * Move multiple history records to trash.
   * @param {string[]} paths - Absolute paths to TGA files.
   * @returns {Promise<{status: string, results: Array}>}
   */
  async trashMany(paths) {
    return this.post('/history/trash/move', { paths });
  }

  /**
   * Fetch all trashed items.
   * @returns {Promise<Array>}
   */
  async getTrash() {
    return this.get('/history/trash');
  }

  /**
   * Get count of trashed items.
   * @returns {Promise<{count: number}>}
   */
  async getTrashCount() {
    return this.get('/history/trash/count');
  }

  /**
   * Restore a single trashed livery.
   * @param {string} path - Absolute path to TGA in trash dir.
   * @returns {Promise<{status: string}>}
   */
  async restoreFromTrash(path) {
    return this.post('/history/trash/restore', { path });
  }

  /**
   * Restore multiple trashed liveries.
   * @param {string[]} paths - Absolute paths to TGA files in trash dir.
   * @returns {Promise<{status: string, results: Array}>}
   */
  async restoreManyFromTrash(paths) {
    return this.post('/history/trash/restore-many', { paths });
  }

  /**
   * Permanently delete all trashed items.
   * @returns {Promise<{status: string}>}
   */
  async clearTrash() {
    return this.post('/history/trash/clear', {});
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
