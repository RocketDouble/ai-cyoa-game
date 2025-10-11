import type { StorySegment, Choice } from '../types';

/**
 * Token management utilities for AI context truncation
 * Ensures we stay within the 8192 token limit while maximizing context
 */
export class TokenManager {
  // Rough token estimation: ~4 characters per token for English text
  private static readonly CHARS_PER_TOKEN = 4;
  private static readonly MAX_TOKENS = 8192;
  private static readonly RESERVED_TOKENS = 1000; // Reserve for system prompt, response, etc.
  private static readonly MAX_CONTEXT_TOKENS = TokenManager.MAX_TOKENS - TokenManager.RESERVED_TOKENS;

  /**
   * Estimate token count from text
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Truncate text to fit within token limit
   */
  static truncateToTokenLimit(text: string, maxTokens: number = this.MAX_CONTEXT_TOKENS): string {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) {
      return text;
    }

    const maxChars = maxTokens * this.CHARS_PER_TOKEN;
    const truncated = text.substring(0, maxChars);
    
    // Try to truncate at a sentence boundary
    const lastSentence = truncated.lastIndexOf('. ');
    if (lastSentence > maxChars * 0.8) { // Only use sentence boundary if it's not too far back
      return truncated.substring(0, lastSentence + 1) + ' [truncated]';
    }
    
    return truncated + ' [truncated]';
  }

  /**
   * Build context with token-aware truncation for story continuation
   * Includes previous segments and actions with smart truncation
   */
  static buildTruncatedContext(
    segments: StorySegment[],
    choices: Choice[],
    maxTokens: number = this.MAX_CONTEXT_TOKENS
  ): { contextText: string; segmentsIncluded: number; choicesIncluded: number } {
    let contextText = '';
    let currentTokens = 0;
    let segmentsIncluded = 0;
    let choicesIncluded = 0;

    // Start with most recent and work backwards
    const reversedSegments = [...segments].reverse();
    const reversedChoices = [...choices].reverse();

    // Add segments and choices in pairs, starting from most recent
    for (let i = 0; i < Math.max(reversedSegments.length, reversedChoices.length); i++) {
      let segmentText = '';
      let choiceText = '';

      // Add segment if available
      if (i < reversedSegments.length) {
        const segment = reversedSegments[i];
        const truncatedText = segment.text.length > 300 
          ? segment.text.substring(0, 300) + '...' 
          : segment.text;
        segmentText = `Story ${segments.length - i}: ${truncatedText}\n`;
      }

      // Add corresponding choice if available
      if (i < reversedChoices.length) {
        const choice = reversedChoices[i];
        choiceText = `Action ${choices.length - i}: ${choice.text}\n`;
      }

      const combinedText = segmentText + choiceText;
      const combinedTokens = this.estimateTokens(combinedText);

      // Check if adding this would exceed limit
      if (currentTokens + combinedTokens > maxTokens) {
        break;
      }

      // Add to context (prepend to maintain chronological order)
      contextText = combinedText + contextText;
      currentTokens += combinedTokens;

      if (segmentText) segmentsIncluded++;
      if (choiceText) choicesIncluded++;
    }

    return { contextText, segmentsIncluded, choicesIncluded };
  }

  /**
   * Build enhanced context that prioritizes the most recent segment and action
   * Useful for maintaining immediate narrative continuity
   */
  static buildEnhancedContext(
    segments: StorySegment[],
    choices: Choice[],
    currentScene: string,
    maxTokens: number = this.MAX_CONTEXT_TOKENS
  ): {
    contextText: string;
    previousSegment: string | null;
    previousAction: string | null;
    segmentsIncluded: number;
    choicesIncluded: number;
  } {
    let previousSegment: string | null = null;
    let previousAction: string | null = null;

    // Always include the most recent segment and action if available
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      previousSegment = lastSegment.text.length > 500 
        ? lastSegment.text.substring(0, 500) + '...'
        : lastSegment.text;
    }

    if (choices.length > 0) {
      const lastChoice = choices[choices.length - 1];
      previousAction = lastChoice.text;
    }

    // Calculate tokens used by immediate context
    const immediateContextTokens = this.estimateTokens(`Previous segment: ${previousSegment || ''}\nPrevious action: ${previousAction || ''}\nCurrent scene: ${currentScene}`);

    // Build the rest of the context
    const remainingTokens = maxTokens - immediateContextTokens;

    const { contextText, segmentsIncluded, choicesIncluded } = this.buildTruncatedContext(
      segments.slice(0, -1), // Exclude the last segment since we're handling it separately
      choices.slice(0, -1),   // Exclude the last choice since we're handling it separately
      remainingTokens
    );

    return {
      contextText,
      previousSegment,
      previousAction,
      segmentsIncluded: segmentsIncluded + (previousSegment ? 1 : 0),
      choicesIncluded: choicesIncluded + (previousAction ? 1 : 0)
    };
  }

  /**
   * Validate that a prompt fits within token limits
   */
  static validatePromptSize(prompt: string): { valid: boolean; estimatedTokens: number; maxTokens: number } {
    const estimatedTokens = this.estimateTokens(prompt);
    return {
      valid: estimatedTokens <= this.MAX_CONTEXT_TOKENS,
      estimatedTokens,
      maxTokens: this.MAX_CONTEXT_TOKENS
    };
  }

  /**
   * Get token usage statistics for debugging
   */
  static getTokenStats(text: string): {
    estimatedTokens: number;
    characters: number;
    maxTokens: number;
    remainingTokens: number;
    utilizationPercent: number;
  } {
    const estimatedTokens = this.estimateTokens(text);
    const remainingTokens = this.MAX_CONTEXT_TOKENS - estimatedTokens;
    const utilizationPercent = Math.round((estimatedTokens / this.MAX_CONTEXT_TOKENS) * 100);

    return {
      estimatedTokens,
      characters: text.length,
      maxTokens: this.MAX_CONTEXT_TOKENS,
      remainingTokens: Math.max(0, remainingTokens),
      utilizationPercent
    };
  }
}