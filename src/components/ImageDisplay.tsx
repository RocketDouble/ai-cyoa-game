import React, { useState, useEffect, useCallback } from 'react';

interface ImageDisplayProps {
  imageUrl?: string;
  altText: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  fallbackImageUrl?: string;
}

/**
 * ImageDisplay component renders AI-generated images with loading states,
 * error handling, graceful degradation, and image caching optimization.
 * 
 * Requirements addressed:
 * - 4.3: Display images alongside story text
 * - 4.5: Continue story without blocking on image failures
 * - 6.3: Integrate images seamlessly with story text layout
 */
export const ImageDisplay: React.FC<ImageDisplayProps> = ({
  imageUrl,
  altText,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
  fallbackImageUrl
}) => {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [cachedImageUrl, setCachedImageUrl] = useState<string | null>(null);

  // Reset states when imageUrl changes
  useEffect(() => {
    setImageLoadError(false);
    setImageLoaded(false);
    setCachedImageUrl(null);
  }, [imageUrl]);

  // Handle image load success
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageLoadError(false);
    if (imageUrl) {
      setCachedImageUrl(imageUrl);
    }
  }, [imageUrl]);

  // Handle image load error
  const handleImageError = useCallback(() => {
    setImageLoadError(true);
    setImageLoaded(false);
  }, []);

  // Handle retry action
  const handleRetry = useCallback(() => {
    setImageLoadError(false);
    setImageLoaded(false);
    if (onRetry) {
      onRetry();
    }
  }, [onRetry]);

  // Determine which image URL to use
  const displayImageUrl = imageUrl || cachedImageUrl || fallbackImageUrl;

  // Loading state
  if (isLoading) {
    return (
      <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}>
        <div className="aspect-video w-full">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="text-sm text-gray-600">Generating image...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state with retry option
  if (error && !displayImageUrl) {
    return (
      <div className={`relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg ${className}`}>
        <div className="aspect-video w-full">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-3">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">Image Generation Failed</h4>
              <p className="text-xs text-gray-500 mb-3 max-w-xs">{error}</p>
              {onRetry && (
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No image state (graceful degradation)
  if (!displayImageUrl) {
    return (
      <div className={`relative bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <div className="aspect-video w-full">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <svg className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="text-sm">No image available</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Image display with loading overlay
  return (
    <div className={`relative rounded-lg overflow-hidden shadow-md ${className}`}>
      {/* Loading overlay while image loads */}
      {!imageLoaded && !imageLoadError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2 mx-auto"></div>
              <div className="h-3 bg-gray-200 rounded w-16 mx-auto"></div>
            </div>
          </div>
        </div>
      )}

      {/* Main image */}
      <img
        src={displayImageUrl}
        alt={altText}
        className={`w-full h-auto transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        style={{
          aspectRatio: '16/9',
          objectFit: 'cover',
          minHeight: '200px'
        }}
      />

      {/* Error overlay for image load failures */}
      {imageLoadError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center p-4">
            <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-gray-200 mb-2">
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="text-xs text-gray-500 mb-2">Failed to load image</div>
            {onRetry && (
              <button
                onClick={handleRetry}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Image caption/alt text overlay (optional, for accessibility) */}
      {imageLoaded && altText && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
          <div className="text-white text-sm opacity-0 hover:opacity-100 transition-opacity duration-200">
            {altText}
          </div>
        </div>
      )}
    </div>
  );
};



export default ImageDisplay;