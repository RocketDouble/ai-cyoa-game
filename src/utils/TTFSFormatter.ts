/**
 * Utility functions for formatting Time to First Token (TTFS) measurements
 */
export class TTFSFormatter {
  /**
   * Format TTFS in milliseconds to a human-readable string
   * @param ttfsMs TTFS in milliseconds
   * @returns Formatted string (e.g., "1.2s", "850ms")
   */
  static formatTTFS(ttfsMs: number): string {
    if (ttfsMs >= 1000) {
      return `${(ttfsMs / 1000).toFixed(1)}s`;
    } else {
      return `${Math.round(ttfsMs)}ms`;
    }
  }

  /**
   * Get a color class based on TTFS performance
   * @param ttfsMs TTFS in milliseconds
   * @returns Tailwind color classes
   */
  static getTTFSColorClass(ttfsMs: number): string {
    if (ttfsMs < 1000) {
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
    } else if (ttfsMs < 3000) {
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
    } else if (ttfsMs < 5000) {
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
    } else {
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
    }
  }

  /**
   * Get a performance label for TTFS
   * @param ttfsMs TTFS in milliseconds
   * @returns Performance label
   */
  static getTTFSPerformanceLabel(ttfsMs: number): string {
    if (ttfsMs < 1000) {
      return 'Excellent';
    } else if (ttfsMs < 3000) {
      return 'Good';
    } else if (ttfsMs < 5000) {
      return 'Fair';
    } else {
      return 'Slow';
    }
  }
}