import { BaseService } from './BaseService';

/**
 * UpscaleService — GPU upscaling and iRacing deployment.
 *
 * Wraps two backend operations:
 * - `/api/upscale` — runs Real-ESRGAN 4× on an existing livery TGA.
 * - `/api/deploy` — copies a TGA into the iRacing paint folder.
 *
 * Both operations are compute/IO-heavy; callers should show a progress
 * indicator while the requests are in flight.
 */
class UpscaleService extends BaseService {
  constructor() {
    super('/api');
  }

  /**
   * 4× upscale a livery using Real-ESRGAN (requires NVIDIA GPU).
   * @param {string} sourcePath - Server-side path to the source TGA/PNG.
   * @returns {Promise<{output_path: string}>} Path to the upscaled output file.
   */
  async upscale(sourcePath) {
    return this.post('/upscale', { source_path: sourcePath });
  }

  /**
   * Deploy a livery TGA to the iRacing paint folder.
   * @param {string} liveryPath - Server-side path to the TGA to deploy.
   * @param {string} carName - iRacing car folder name (e.g. `'porsche992rgt3'`).
   * @param {string} customerId - iRacing customer ID used in the paint filename.
   * @returns {Promise<{ok: boolean}>}
   */
  async deploy(liveryPath, carName, customerId) {
    return this.post('/deploy', {
      path: liveryPath,
      car_folder: carName,
      customer_id: customerId,
    });
  }

  /**
   * Deploy the car's factory default diffuse texture to iRacing.
   * @param {string} carFolder - iRacing car folder name.
   * @returns {Promise<{ok: boolean}>}
   */
  async deployDefault(carFolder) {
    return this.post('/deploy-default', { car_folder: carFolder });
  }

  /**
   * Clear a custom paint file from the iRacing paint folder.
   * @param {string} carFolder - iRacing car folder name.
   * @param {'texture'|'spec'} type - Which file to clear.
   * @returns {Promise<{ok: boolean}>}
   */
  async clearPaint(carFolder, type = 'texture') {
    return this.post('/clear-paint', { car_folder: carFolder, type });
  }

  /**
   * Open the native Save-As dialog to download a source file (e.g. TGA).
   * @param {string} sourcePath - Absolute server-side path to copy from.
   * @param {string} [filename]  - Suggested filename in the dialog.
   * @returns {Promise<{path: string|null}>}
   */
  async downloadFile(sourcePath, filename) {
    return this.post('/download-file', { path: sourcePath, filename: filename || '' });
  }

  /**
   * Open a file's parent folder in Windows Explorer.
   * @param {string} path - Absolute path to highlight.
   * @returns {Promise<{ok: boolean}>}
   */
  async openExplorer(path) {
    return this.post('/open-explorer', { path });
  }

  /**
   * Get base64-encoded image data for a livery file (supports TGA).
   * @param {string} path - Server-side path to the image.
   * @returns {Promise<{base64: string}>}
   */
  async getImageData(path) {
    return this.post('/image-data', { path });
  }

  /**
   * Open the native file-picker dialog.
   * @param {string[]} [fileTypes] - Filter strings (e.g. ['Image Files (*.png;*.jpg;*.tga)']).
   * @returns {Promise<{path: string}>}
   */
  async pickFile(fileTypes) {
    return this.post('/pick-file', { file_types: fileTypes || [] });
  }

  /**
   * Open the native folder-picker dialog.
   * @returns {Promise<{path: string}>}
   */
  async pickFolder() {
    return this.post('/pick-folder', {});
  }

  /**
   * Upload a file via the generic upload-file endpoint.
   * @param {File} file - File object to upload.
   * @param {string} category - Upload category (e.g. 'upscale').
   * @returns {Promise<{path: string}>}
   */
  async uploadFile(file, category) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    return this.post('/upload-file', formData);
  }
}

export default new UpscaleService();
