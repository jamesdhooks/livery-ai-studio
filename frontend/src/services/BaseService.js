/**
 * BaseService — base class for all API services.
 *
 * Provides a thin HTTP layer over the native `fetch` API.  All concrete
 * services extend this class and use `get()`, `post()`, `put()`, and
 * `delete()` instead of calling `fetch()` directly.
 *
 * JSON is serialised/deserialised automatically.  `FormData` bodies are
 * passed through as-is (no Content-Type header is added, allowing the
 * browser to set the correct multipart boundary).
 *
 * On non-2xx responses the method rejects with an `Error` whose message
 * comes from the `error` or `message` field of the JSON body, or falls
 * back to `"HTTP {status}: {statusText}"`.
 */
export class BaseService {
  /**
   * @param {string} [basePath='/api'] - Root path prepended to every request URL.
   */
  constructor(basePath = '/api') {
    this.basePath = basePath;
  }

  /**
   * Build the full URL for a given path segment.
   * @param {string} path - Path relative to `basePath` (e.g. `'/config'`).
   * @returns {string}
   */
  _url(path) {
    return `${this.basePath}${path}`;
  }

  /**
   * Core fetch wrapper used by all public methods.
   * @param {string} method - HTTP verb (`'GET'`, `'POST'`, etc.).
   * @param {string} path - Path relative to `basePath`.
   * @param {Object|FormData|null} [body=null] - Request body.
   * @param {RequestInit} [options={}] - Additional fetch options.
   * @returns {Promise<any>} Parsed JSON body, or the raw Response for non-JSON responses.
   * @throws {Error} When the response status is not 2xx.
   */
  async _request(method, path, body = null, options = {}) {
    const url = this._url(path);
    const fetchOptions = {
      method,
      headers: {},
      ...options,
    };

    if (body !== null && !(body instanceof FormData)) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // ignore JSON parse error
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response;
  }

  /**
   * Send a GET request.
   * @param {string} path
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  async get(path, options = {}) {
    return this._request('GET', path, null, options);
  }

  /**
   * Send a POST request.
   * @param {string} path
   * @param {Object|FormData} body
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  async post(path, body, options = {}) {
    return this._request('POST', path, body, options);
  }

  /**
   * Send a PUT request.
   * @param {string} path
   * @param {Object|FormData} body
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  async put(path, body, options = {}) {
    return this._request('PUT', path, body, options);
  }

  /**
   * Send a DELETE request.
   * @param {string} path
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  async delete(path, options = {}) {
    return this._request('DELETE', path, null, options);
  }
}

export default BaseService;
