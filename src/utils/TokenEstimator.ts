/**
 * Utility for estimating token counts when API doesn't provide usage data
 * This is a rough approximation and should only be used as a fallback
 */
export class TokenEstimator {
  /**
   * Estimate token count for text using a simple heuristic
   * Rough approximation: 1 token ≈ 4 characters for English text
   * This is based on OpenAI's general guidance but varies by model and language
   */
  static estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    
    // Remove extra whitespace and normalize
    const normalizedText = text.trim().replace(/\s+/g, ' ');
    
    // Simple heuristic: ~4 characters per token for English
    // This is a rough approximation and will vary significantly
    const estimatedTokens = Math.ceil(normalizedText.length / 4);
    
    return Math.max(1, estimatedTokens); // Minimum 1 token for non-empty text
  }

  /**
   * Estimate tokens for an array of messages
   */
  static estimateMessagesTokens(messages: Array<{ role: string; content: string }>): number {
    let totalTokens = 0;
    
    for (const message of messages) {
      // Add tokens for the message content
      totalTokens += this.estimateTokens(message.content);
      
      // Add overhead for message structure (role, formatting, etc.)
      // OpenAI typically adds ~4 tokens per message for formatting
      totalTokens += 4;
    }
    
    // Add overhead for the conversation structure
    totalTokens += 2;
    
    return totalTokens;
  }

  /**
   * Create estimated token usage when API doesn't provide it
   */
  static createEstimatedUsage(
    inputMessages: Array<{ role: string; content: string }>,
    outputText: string
  ): import('../types').TokenUsage {
    return {
      inputTokens: this.estimateMessagesTokens(inputMessages),
      outputTokens: this.estimateTokens(outputText)
    };
  }
}