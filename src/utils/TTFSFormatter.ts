import type { TokenUsage } from '../types';

/**
 * Utility functions for formatting Time to First Token (TTFS) measurements and token usage
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
   * Format token usage to a human-readable string
   * @param tokenUsage Token usage object
   * @returns Formatted string (e.g., "5673 → 200")
   */
  static formatTokenUsage(tokenUsage: TokenUsage): string {
    return `${tokenUsage.inputTokens.toLocaleString()} → ${tokenUsage.outputTokens.toLocaleString()}`;
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
   * Get a color class based on token usage (output tokens)
   * @param outputTokens Number of output tokens
   * @returns Tailwind color classes
   */
  static getTokenColorClass(outputTokens: number): string {
    if (outputTokens < 100) {
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
    } else if (outputTokens < 500) {
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
    } else if (outputTokens < 1000) {
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
    } else {
      return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30';
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

  /**
   * Format combined TTFS and token usage for display
   * @param ttfs TTFS in milliseconds (optional)
   * @param tokenUsage Token usage object (optional)
   * @returns Object with formatted strings and color classes
   */
  static formatMetrics(ttfs?: number, tokenUsage?: TokenUsage): {
    ttfsDisplay?: string;
    tokenDisplay?: string;
    ttfsColorClass?: string;
    tokenColorClass?: string;
  } {
    const result: ReturnType<typeof TTFSFormatter.formatMetrics> = {};

    if (ttfs !== undefined) {
      result.ttfsDisplay = `TTFS: ${this.formatTTFS(ttfs)}`;
      result.ttfsColorClass = this.getTTFSColorClass(ttfs);
    }

    if (tokenUsage) {
      result.tokenDisplay = `Tokens: ${this.formatTokenUsage(tokenUsage)}`;
      result.tokenColorClass = this.getTokenColorClass(tokenUsage.outputTokens);
    }

    return result;
  }
}