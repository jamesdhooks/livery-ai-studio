/**
 * General utility functions.
 */

/**
 * Escape HTML characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Format a timestamp for display.
 * @param {string|number} timestamp
 * @returns {string}
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (isNaN(date)) return String(timestamp);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a file size in bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get the filename from a path.
 * @param {string} path
 * @returns {string}
 */
export function getFilename(path) {
  return path ? path.split(/[/\\]/).pop() : '';
}

/**
 * Debounce a function.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Get starred cars from localStorage.
 * @returns {Set<string>}
 */
export function getStarredCars() {
  try {
    return new Set(JSON.parse(localStorage.getItem('starredCars') || '[]'));
  } catch {
    return new Set();
  }
}

/**
 * Save starred cars to localStorage.
 * @param {Set<string>} set
 */
export function saveStarredCars(set) {
  localStorage.setItem('starredCars', JSON.stringify([...set]));
}
