/**
 * Utility functions for detecting model capabilities and characteristics
 */
export class ModelDetection {
  /**
   * Check if a model is likely a thinking model based on its name
   * Thinking models typically have "thinking" in their name (e.g., nano-gpt thinking models)
   */
  static isThinkingModel(modelName: string): boolean {
    if (!modelName || typeof modelName !== 'string') {
      return false;
    }
    
    const lowerModelName = modelName.toLowerCase();
    
    // Common patterns for thinking models
    const thinkingPatterns = [
      'thinking',
      'think',
      'reasoning',
      'reason',
      'cot', // Chain of Thought
      'reflection',
      'reflect'
    ];
    
    return thinkingPatterns.some(pattern => lowerModelName.includes(pattern));
  }

  /**
   * Get a user-friendly warning message for thinking models
   */
  static getThinkingModelWarning(feature: string = 'this feature'): string {
    return `This model appears to be a thinking model. ${feature} may not work properly with thinking models. Consider using a standard model for better compatibility.`;
  }

  /**
   * Check if a model name suggests it's optimized for creative writing
   */
  static isCreativeModel(modelName: string): boolean {
    if (!modelName || typeof modelName !== 'string') {
      return false;
    }
    
    const lowerModelName = modelName.toLowerCase();
    
    const creativePatterns = [
      'creative',
      'story',
      'narrative',
      'writing',
      'fiction',
      'novel',
      'poet'
    ];
    
    return creativePatterns.some(pattern => lowerModelName.includes(pattern));
  }

  /**
   * Get model capability suggestions based on model name
   */
  static getModelSuggestions(modelName: string): {
    isThinking: boolean;
    isCreative: boolean;
    suggestions: string[];
  } {
    const isThinking = this.isThinkingModel(modelName);
    const isCreative = this.isCreativeModel(modelName);
    const suggestions: string[] = [];

    if (isThinking) {
      suggestions.push('Best for complex reasoning and detailed story generation');
      suggestions.push('May not work with simple utility features like scene generation');
      suggestions.push('Excellent for main story gameplay with thinking display');
    }

    if (isCreative) {
      suggestions.push('Optimized for creative writing and storytelling');
      suggestions.push('Great for generating engaging narratives');
    }

    if (!isThinking && !isCreative) {
      suggestions.push('General-purpose model suitable for all features');
      suggestions.push('Works well with both story generation and utility features');
    }

    return {
      isThinking,
      isCreative,
      suggestions
    };
  }
}