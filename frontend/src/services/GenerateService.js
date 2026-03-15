import { BaseService } from './BaseService';

/**
 * GenerateService — handles livery generation and file-upload operations.
 *
 * Wraps the `/api/generate` endpoint (Gemini AI call) and the
 * `/api/upload/{category}` endpoint for uploading wireframe, base-texture,
 * and reference images.
 */
class GenerateService extends BaseService {
  constructor() {
    super('/api');
  }

  /**
   * Trigger a new livery generation.
   * @param {Object} params - Generation parameters (model, car_folder, prompt, wireframe, etc.).
   * @returns {Promise<{livery_path: string, preview_url: string, cost: number}>}
   */
  async generate(params) {
    return this.post('/generate', params);
  }

  /**
   * Upload an image file to a named category bucket.
   * @param {'wire'|'base'|'reference'} category - Upload sub-directory.
   * @param {File} file - The file to upload.
   * @param {{ car_folder?: string, car_display?: string }} [meta] - Optional car association.
   * @returns {Promise<{path: string}>} Server path of the stored file.
   */
  async uploadFile(category, file, meta = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (meta.car_folder) formData.append('car_folder', meta.car_folder);
    if (meta.car_display) formData.append('car_display', meta.car_display);
    return this.post(`/upload-file`, formData);
  }

  /**
   * Browse previously uploaded files in a category bucket.
   * Returns items with metadata (car association, timestamps).
   * @param {'wire'|'base'|'reference'} category
   * @returns {Promise<Array<{name: string, path: string, car_folder: string, car_display: string, uploaded_at: number}>>}
   */
  async browseUploads(category) {
    return this.get(`/browse-uploads/${category}`);
  }

  /**
   * Delete an uploaded file and its sidecar metadata.
   * @param {string} path - Absolute path of the file to delete.
   * @returns {Promise<{deleted: string[]}>}
   */
  async deleteUpload(path) {
    return this._request('DELETE', '/upload-file', { path });
  }

  /**
   * List previously uploaded files in a category bucket.
   * @param {'wire'|'base'|'reference'} category
   * @returns {Promise<Array<{name: string, path: string}>>}
   */
  async getUploads(category) {
    return this.get(`/uploads/${category}`);
  }

  /**
   * Enhance a prompt using Gemini AI.
   * @param {string} prompt - The original prompt text.
   * @param {string} context - Optional context (car number, team, etc.).
   * @param {string} mode - 'new' or 'modify'.
   * @returns {Promise<string>} The enhanced prompt text.
   */
  async enhancePrompt(prompt, context, mode) {
    const data = await this.post('/enhance-prompt', { prompt, context, mode });
    return data.enhanced || data.prompt || prompt;
  }

  /**
   * Get the current enhance guidance (user override or default).
   * @returns {Promise<{guidance: string, default: string}>}
   */
  async getEnhanceGuidance() {
    return this.get('/enhance-guidance');
  }

  /**
   * Save custom enhance guidance.
   * @param {string} guidance - The custom guidance text (empty string to reset to default).
   * @returns {Promise<{ok: boolean}>}
   */
  async saveEnhanceGuidance(guidance) {
    return this.post('/enhance-guidance', { guidance });
  }
}

export default new GenerateService();
