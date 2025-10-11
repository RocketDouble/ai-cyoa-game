/**
 * Utility functions for image handling and optimization
 */

/**
 * Utility function to preload images for better performance
 */
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to preload image: ${url}`));
    img.src = url;
  });
};

/**
 * Utility function to check if an image URL is valid
 */
export const validateImageUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Hook for managing image caching and optimization
 */
import { useState, useCallback } from 'react';

export const useImageCache = () => {
  const [cache, setCache] = useState<Map<string, string>>(new Map());

  const cacheImage = useCallback((key: string, url: string) => {
    setCache(prev => new Map(prev).set(key, url));
  }, []);

  const getCachedImage = useCallback((key: string): string | undefined => {
    return cache.get(key);
  }, [cache]);

  const clearCache = useCallback(() => {
    setCache(new Map());
  }, []);

  return {
    cacheImage,
    getCachedImage,
    clearCache,
    cacheSize: cache.size
  };
};