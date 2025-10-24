import type { StorySegment, Choice } from '../types';

/**
 * Token management utilities for AI context truncation
 * Ensures we stay within the 32k token limit while maximizing context
 */
export class TokenManager {
  // Rough token estimation: ~4 characters per token for English text
  private static readonly CHARS_PER_TOKEN = 4;
  private static readonly MAX_TOKENS = 32768; // 32k tokens
  private static readonly RESERVED_TOKENS = 2000; // Reserve for system prompt, response, etc.
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
        // Don't pre-truncate segments - let the token budget decide
        segmentText = `Story ${segments.length - i}: ${segment.text}\n`;
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
        // Try to fit a truncated version of the segment if we have some room left
        const remainingTokens = maxTokens - currentTokens;
        if (remainingTokens > 50 && segmentText) { // Only if we have meaningful space left
          const segment = reversedSegments[i];
          
          // Calculate space for choice text if present
          const choiceTokens = choiceText ? this.estimateTokens(choiceText) : 0;
          const segmentBudget = remainingTokens - choiceTokens;
          
          if (segmentBudget > 20) { // Minimum viable segment size
            const segmentChars = segmentBudget * this.CHARS_PER_TOKEN;
            const truncatedSegmentText = segment.text.length > segmentChars 
              ? segment.text.substring(0, segmentChars) + '...' 
              : segment.text;
            
            const finalSegmentText = `Story ${segments.length - i}: ${truncatedSegmentText}\n`;
            const finalCombinedText = finalSegmentText + choiceText;
            const finalTokens = this.estimateTokens(finalCombinedText);
            
            if (currentTokens + finalTokens <= maxTokens) {
              contextText = finalCombinedText + contextText;
              currentTokens += finalTokens;
              if (finalSegmentText) segmentsIncluded++;
              if (choiceText) choicesIncluded++;
            }
          }
        }
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

    // Get the most recent segment and action if available (without pre-truncating)
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      previousSegment = lastSegment.text;
    }

    if (choices.length > 0) {
      const lastChoice = choices[choices.length - 1];
      previousAction = lastChoice.text;
    }

    // Calculate base tokens for the template structure (without content)
    const templateTokens = this.estimateTokens(`Previous segment: \nPrevious action: \nCurrent scene: ${currentScene}`);
    
    // Calculate tokens for the action (usually small)
    const actionTokens = previousAction ? this.estimateTokens(previousAction) : 0;
    
    // Reserve tokens for immediate context structure
    const reservedTokens = templateTokens + actionTokens + 100; // 100 token buffer
    
    // Calculate how much space we have for the previous segment and historical context
    const availableTokens = maxTokens - reservedTokens;
    
    // Allocate tokens: prioritize recent segment, but leave room for historical context
    const minHistoricalTokens = Math.min(1000, availableTokens * 0.3); // At least 30% for history
    const maxSegmentTokens = availableTokens - minHistoricalTokens;
    
    // Truncate previous segment if needed
    if (previousSegment) {
      const segmentTokens = this.estimateTokens(previousSegment);
      if (segmentTokens > maxSegmentTokens) {
        const maxChars = maxSegmentTokens * this.CHARS_PER_TOKEN;
        previousSegment = previousSegment.substring(0, maxChars) + '...';
      }
    }

    // Calculate actual tokens used by immediate context
    const actualImmediateTokens = this.estimateTokens(`Previous segment: ${previousSegment || ''}\nPrevious action: ${previousAction || ''}\nCurrent scene: ${currentScene}`);

    // Build the rest of the context with remaining tokens
    const remainingTokens = maxTokens - actualImmediateTokens;

    const { contextText, segmentsIncluded, choicesIncluded } = this.buildTruncatedContext(
      segments.slice(0, -1), // Exclude the last segment since we're handling it separately
      choices.slice(0, -1),   // Exclude the last choice since we're handling it separately
      Math.max(0, remainingTokens) // Ensure we don't pass negative tokens
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

  /**
   * Debug context building to help identify truncation issues
   */
  static debugContextBuilding(
    segments: StorySegment[],
    choices: Choice[],
    currentScene: string,
    maxTokens: number = this.MAX_CONTEXT_TOKENS
  ): {
    totalSegments: number;
    totalChoices: number;
    segmentsIncluded: number;
    choicesIncluded: number;
    contextTokens: number;
    maxTokens: number;
    utilizationPercent: number;
    truncationOccurred: boolean;
  } {
    const result = this.buildEnhancedContext(segments, choices, currentScene, maxTokens);
    const fullContextText = `${result.contextText}Previous segment: ${result.previousSegment || ''}\nPrevious action: ${result.previousAction || ''}\nCurrent scene: ${currentScene}`;
    const contextTokens = this.estimateTokens(fullContextText);
    
    return {
      totalSegments: segments.length,
      totalChoices: choices.length,
      segmentsIncluded: result.segmentsIncluded,
      choicesIncluded: result.choicesIncluded,
      contextTokens,
      maxTokens,
      utilizationPercent: Math.round((contextTokens / maxTokens) * 100),
      truncationOccurred: result.segmentsIncluded < segments.length || result.choicesIncluded < choices.length
    };
  }
}