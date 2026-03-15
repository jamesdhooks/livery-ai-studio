import { BaseService } from './BaseService';

/**
 * CarOverrideService — persists per-car wireframe/base texture overrides.
 *
 * Overrides are stored in config.json under `car_overrides[car_folder]`.
 * The server validates file existence on GET — missing files are cleared
 * automatically and an empty string is returned (triggering library fallback).
 */
class CarOverrideService extends BaseService {
  constructor() {
    super('/api');
  }

  /**
   * Fetch the stored override paths for a car.
   * Missing files are cleared server-side; empty string means "use library default".
   * @param {string} carFolder
   * @returns {Promise<{ car_folder: string, wire: string, base: string }>}
   */
  async getOverride(carFolder) {
    return this.get(`/car-override/${encodeURIComponent(carFolder)}`);
  }

  /**
   * Persist wire and/or base override paths for a car.
   * Pass null or '' to clear a field.
   * @param {string} carFolder
   * @param {{ wire?: string|null, base?: string|null }} fields
   * @returns {Promise<{ status: string, wire: string, base: string }>}
   */
  async setOverride(carFolder, fields) {
    return this.post(`/car-override/${encodeURIComponent(carFolder)}`, fields);
  }
}

export default new CarOverrideService();
