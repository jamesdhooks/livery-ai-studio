import React, { useState } from 'react';

/**
 * Image — responsive image with skeleton loader, spinner, and fade-in animation by default.
 *
 * Shows a pulsing skeleton with spinner while the image loads, then fades it in.
 * Resets on src change.
 *
 * @param {string}   src        - Image URL
 * @param {string}   alt        - Alt text
 * @param {string}   [className] - Additional Tailwind classes for the container
 * @param {Function} [onLoad]   - Callback when image finishes loading
 * @param {boolean}  [skeleton] - Show skeleton loader (default: true)
 * @param {...rest}  rest       - Other img attributes (title, style, etc.)
 */
export function Image({ src, alt, className = '', onLoad, skeleton = true, ...rest }) {
  const [loaded, setLoaded] = useState(false);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  // Reset loaded state when src changes
  React.useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Skeleton + spinner (shown while loading) */}
      {skeleton && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-bg-card via-bg-input to-bg-card bg-[length:200%_100%] animate-pulse rounded">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      )}
      {/* Actual image with fade-in */}
      <img
        src={src}
        alt={alt}
        className={`block max-w-full max-h-full transition-opacity duration-500 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleLoad}
        {...rest}
      />
    </div>
  );
}

export default Image;
