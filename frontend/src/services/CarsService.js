import { BaseService } from './BaseService';

/**
 * CarsService — provides the list of available iRacing car templates and
 * utility methods for building car image URLs.
 *
 * Car data is sourced from the server-side `library/` directory (pre-extracted
 * PSD templates).  User-defined overrides live in `data/cars/`.
 */
class CarsService extends BaseService {
  constructor() {
    super('/api');
  }

  /**
   * Fetch the full list of available cars.
   * @returns {Promise<Array<{folder: string, display: string}>>}
   */
  async getCars() {
    return this.get('/cars');
  }

  /**
   * Build the URL for a car's UV wireframe image.
   * @param {string} slug - Car folder name (e.g. `'porsche992rgt3'`).
   * @returns {string}
   */
  getWireframeUrl(slug) {
    return `/api/library/image/${slug}/wire.jpg`;
  }

  /**
   * Build the URL for a car's diffuse (base colour) image.
   * @param {string} slug - Car folder name.
   * @returns {string}
   */
  getDiffuseUrl(slug) {
    return `/api/library/image/${slug}/diffuse.jpg`;
  }

  /**
   * Start a folder-based car import (PSD extraction).
   * @param {string} folderPath - Absolute path to folder containing PSD files.
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async importFromFolder(folderPath) {
    return this.post('/library/import/folder', { folder_path: folderPath });
  }

  /**
   * Start a ZIP-based car import.
   * @param {File[]} files - Array of ZIP File objects.
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async importFromZip(files) {
    const formData = new FormData();
    files.forEach(f => formData.append('zips', f));
    return this.post('/library/import/zip', formData);
  }

  /**
   * Poll the import job status.
   * @returns {Promise<{running: boolean, log: string[], results: object[], done: boolean, error: string|null}>}
   */
  async getImportStatus() {
    return this.get('/library/import/status');
  }

  /**
   * Abort a running import job.
   * @returns {Promise<{ok: boolean}>}
   */
  async abortImport() {
    return this.post('/library/import/abort', {});
  }

  /**
   * Peek at one or more ZIP files without parsing PSDs.
   * Returns livery_map resolution + prefill suggestions for each zip.
   * Also saves the files to a temp dir server-side for subsequent importWithMeta calls.
   * @param {File[]} files
   * @returns {Promise<{results: object[], tmp_dir: string}>}
   */
  async peekZips(files) {
    const formData = new FormData();
    files.forEach(f => formData.append('zips', f));
    return this.post('/library/import/zip-peek', formData);
  }

  /**
   * Import previously-peeked zips with user-supplied metadata for unmapped ones.
   * @param {Array<{tmp_path: string, display_name: string, iracing_folder: string}>} zips
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async importWithMeta(zips) {
    return this.post('/library/import/zip-with-meta', { zips });
  }

  /**
   * Add a custom car entry with optional wire/base images.
   * @param {object} params
   * @param {string} params.folder - iRacing folder name (used as iracing_folder in meta)
   * @param {string} params.display - Human-readable display name
   * @param {File|null} [params.wireFile] - Optional wireframe image
   * @param {File|null} [params.baseFile] - Optional base texture image
   * @returns {Promise<{status: string, folder: string, display: string, slug: string}>}
   */
  async addCustomCarFull({ folder, display, wireFile = null, baseFile = null }) {
    // Step 1: create the meta entry
    const result = await this.post('/cars/custom', { folder, display });
    const slug = result.slug || folder;

    // Step 2: upload images if provided
    if (wireFile) {
      const fd = new FormData();
      fd.append('file', wireFile);
      fd.append('type', 'wire');
      fd.append('slug', slug);
      await this.post('/library/car/upload-image', fd);
    }
    if (baseFile) {
      const fd = new FormData();
      fd.append('file', baseFile);
      fd.append('type', 'diffuse');
      fd.append('slug', slug);
      await this.post('/library/car/upload-image', fd);
    }

    return { ...result, slug };
  }

  /**
   * Add a custom car entry manually (folder + display name).
   * @param {string} folder - The iRacing car folder name.
   * @param {string} display - The human-readable display name.
   * @returns {Promise<{status: string, folder: string, display: string}>}
   */
  async addCustomCar(folder, display) {
    return this.post('/cars/custom', { folder, display });
  }

  /**
   * Delete a custom car entry.
   * @param {string} folder - The car folder name to remove.
   * @returns {Promise<{status: string}>}
   */
  async deleteCustomCar(folder) {
    return this.delete('/cars/custom', { folder });
  }
}

export default new CarsService();
