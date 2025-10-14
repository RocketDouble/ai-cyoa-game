import { AIService, AIServiceError } from './AIService';
import { TokenManager } from '../utils/TokenManager';
import { ThinkingParser } from '../utils/ThinkingParser';
import type { AIConfig, StorySegment, Choice, StoryContext } from '../types';



/**
 * Custom story generation prompts for custom scenario mode
 */
class CustomStoryPrompts {
  /**
   * System prompt for custom story generation
   */
  static readonly CUSTOM_STORY_SYSTEM_PROMPT = `You are a creative storyteller for an interactive Choose Your Own Adventure game in CUSTOM MODE. Your role is to:

1. Continue stories based on user-provided scene descriptions and actions
2. Maintain narrative continuity and consistency
3. Keep responses SHORT, CONCISE, but descriptive (2 paragraphs max)
4. NEVER include choices or options in your response - the user provides their own actions

Guidelines:
- Write in second person ("You...")
- Each story segment should advance the plot meaningfully based on the user's input
- The STORY section should contain ONLY narrative text
- DO NOT include "Do you:", choices, options, or questions in the STORY section
- The user will provide their own custom actions`;

  /**
   * Generate initial story prompt from custom scene description
   */
  static generateCustomInitialStoryPrompt(sceneDescription: string, includeScene: boolean = true): string {
    const sceneFormat = includeScene ? '\nSCENE: [Brief visual description of the current scene for image generation]' : '';
    const sceneInstruction = includeScene ? '' : '\n\nIMPORTANT: Do NOT include a SCENE section in your response. Only provide the STORY section.';
    
    const prompt = `The user has provided this initial setup for their custom adventure:
"${sceneDescription}"

Begin this interactive story by:
1. Expanding on the user's setup, while avoiding purple prose
2. Creating an engaging opening situation
3. Establishing the tone and setting
4. Drawing the reader into the narrative

IMPORTANT: Do NOT include any choices or options. The user will provide their own actions.

Format your response as:
STORY: [The narrative opening - NO choices, NO "Do you:" text, ONLY story narrative]${sceneFormat}${sceneInstruction}`;

    // Ensure we don't exceed token limits even for initial prompts
    return TokenManager.truncateToTokenLimit(prompt);
  }

  /**
   * Generate story continuation prompt from custom action
   */
  static generateCustomContinuationPrompt(
    customAction: string,
    context: StoryContext,
    includeScene: boolean = true
  ): string {
    // Build enhanced context with token-aware truncation
    const {
      contextText,
      previousSegment,
      previousAction,
      segmentsIncluded,
      choicesIncluded
    } = TokenManager.buildEnhancedContext(
      context.storyHistory,
      context.choiceHistory,
      context.currentScene,
      6000 // Leave room for system prompt, user action, and response
    );

    const sceneFormat = includeScene ? '\nSCENE: [Brief visual description of the new scene for image generation]' : '';
    const sceneInstruction = includeScene ? '' : '\n\nIMPORTANT: Do NOT include a SCENE section in your response. Only provide the STORY section.';

    const prompt = `The user chose to: "${customAction}"

IMMEDIATE CONTEXT:
Previous segment: ${previousSegment || 'None'}
Previous action: ${previousAction || 'None'}
Current scene: ${context.currentScene}

STORY HISTORY (${segmentsIncluded} segments, ${choicesIncluded} actions included):
${contextText}

Continue the story based on this action by:
1. Showing the immediate consequences of the user's action
2. Advancing the narrative meaningfully from the previous segment
3. Creating a new situation that flows naturally from their choice
4. Maintaining consistency with previous events and the established narrative

IMPORTANT: Do NOT include any choices or options. The user will provide their own next action.

Format your response as:
STORY: [The narrative continuation - NO choices, NO "Do you:" text, ONLY story narrative]${sceneFormat}${sceneInstruction}`;

    // Final safety check - truncate if still too long
    return TokenManager.truncateToTokenLimit(prompt);
  }
}

/**
 * Service for AI-powered narrative generation in custom scenario mode
 * Handles story creation and continuation based on user-provided scenes and actions
 */
export class CustomStoryService {
  /**
   * Generate the initial story segment from a custom scene description with streaming
   */
  static async generateCustomInitialStoryStream(
    config: AIConfig,
    sceneDescription: string,
    onChunk: (text: string) => void,
    samplerSettings?: import('../types').SamplerSettings,
    onThinkingChunk?: (text: string) => void
  ): Promise<StorySegment & { thinkingContent?: string; ttfs?: number }> {
    const includeScene = config.enableImageGeneration !== false;
    const messages = [
      AIService.createSystemMessage(CustomStoryPrompts.CUSTOM_STORY_SYSTEM_PROMPT),
      AIService.createUserMessage(CustomStoryPrompts.generateCustomInitialStoryPrompt(sceneDescription, includeScene))
    ];

    try {
      const { response, thinkingContent, ttfs } = await AIService.chatCompletionStream(config, messages, onChunk, {
        temperature: samplerSettings?.temperature ?? 0.8,
        maxTokens: 2048,
        onThinkingChunk
      });

      const storySegment = this.parseCustomStoryResponse(response, includeScene);
      return { ...storySegment, thinkingContent, ttfs };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to generate custom initial story: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Generate the initial story segment from a custom scene description
   */
  static async generateCustomInitialStory(
    config: AIConfig,
    sceneDescription: string,
    samplerSettings?: import('../types').SamplerSettings
  ): Promise<StorySegment> {
    const includeScene = config.enableImageGeneration !== false;
    const messages = [
      AIService.createSystemMessage(CustomStoryPrompts.CUSTOM_STORY_SYSTEM_PROMPT),
      AIService.createUserMessage(CustomStoryPrompts.generateCustomInitialStoryPrompt(sceneDescription, includeScene))
    ];

    try {
      const response = await AIService.chatCompletionWithRetry(config, messages, {
        temperature: samplerSettings?.temperature ?? 0.8,
        maxTokens: 2048
      });

      return this.parseCustomStoryResponse(response, includeScene);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to generate custom initial story: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Continue the story based on a user's custom action with streaming
   */
  static async continueCustomStoryStream(
    config: AIConfig,
    customAction: string,
    context: StoryContext,
    onChunk: (text: string) => void,
    samplerSettings?: import('../types').SamplerSettings,
    onThinkingChunk?: (text: string) => void
  ): Promise<StorySegment & { thinkingContent?: string; ttfs?: number }> {
    const includeScene = config.enableImageGeneration !== false;
    const messages = [
      AIService.createSystemMessage(CustomStoryPrompts.CUSTOM_STORY_SYSTEM_PROMPT),
      AIService.createUserMessage(CustomStoryPrompts.generateCustomContinuationPrompt(customAction, context, includeScene))
    ];

    try {
      const { response, thinkingContent, ttfs } = await AIService.chatCompletionStream(config, messages, onChunk, {
        temperature: samplerSettings?.temperature ?? 0.8,
        maxTokens: 2048,
        onThinkingChunk
      });

      const storySegment = this.parseCustomStoryResponse(response, includeScene);
      return { ...storySegment, thinkingContent, ttfs };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to continue custom story: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Continue the story based on a user's custom action
   */
  static async continueCustomStory(
    config: AIConfig,
    customAction: string,
    context: StoryContext,
    samplerSettings?: import('../types').SamplerSettings
  ): Promise<StorySegment> {
    const includeScene = config.enableImageGeneration !== false;
    const messages = [
      AIService.createSystemMessage(CustomStoryPrompts.CUSTOM_STORY_SYSTEM_PROMPT),
      AIService.createUserMessage(CustomStoryPrompts.generateCustomContinuationPrompt(customAction, context, includeScene))
    ];

    try {
      const response = await AIService.chatCompletionWithRetry(config, messages, {
        temperature: samplerSettings?.temperature ?? 0.8,
        maxTokens: 2048
      });

      return this.parseCustomStoryResponse(response, includeScene);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to continue custom story: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Parse custom story response from AI service
   * Custom mode responses do NOT include choices - returns empty choices array
   */
  private static parseCustomStoryResponse(response: string, includeScene: boolean = true): StorySegment {
    try {
      // First, extract and remove any thinking content
      const { cleanedResponse } = ThinkingParser.parseThinkingResponse(response);
      
      const storyMatch = cleanedResponse.match(/STORY:\s*(.*?)(?=SCENE:|$)/s);
      const sceneMatch = cleanedResponse.match(/SCENE:\s*(.*?)$/s);

      if (!storyMatch || !storyMatch[1]) {
        // Try alternative parsing - maybe the AI didn't use the expected format
        const fallbackStory = this.tryFallbackParsing(cleanedResponse);
        if (fallbackStory) {
          return fallbackStory;
        }
        
        throw new Error('No story content found in response');
      }

      const storyText = storyMatch[1].trim();
      // Only use scene description if we requested it, otherwise use a generic placeholder
      // If the AI included a scene despite our instructions not to, ignore it
      const sceneDescription = includeScene && sceneMatch 
        ? sceneMatch[1].trim() 
        : 'A mysterious scene unfolds';

      if (storyText.length < 50) {
        throw new Error('Story content too short');
      }

      // Custom mode always returns empty choices array - user provides their own actions
      return {
        id: this.generateId(),
        text: storyText,
        sceneDescription,
        choices: [] // Empty choices for custom mode
      };
    } catch (error) {
      throw new AIServiceError(
        `Failed to parse custom story response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR',
        false
      );
    }
  }

  /**
   * Generate a unique ID for story segments
   */
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Validate story context for continuation
   */
  static validateStoryContext(context: StoryContext): boolean {
    return (
      context &&
      Array.isArray(context.storyHistory) &&
      Array.isArray(context.choiceHistory) &&
      typeof context.currentScene === 'string' &&
      context.currentScene.length > 0
    );
  }

  /**
   * Create a story context from game state
   */
  static createStoryContext(
    storyHistory: StorySegment[],
    choiceHistory: Choice[],
    currentScene: string
  ): StoryContext {
    return {
      storyHistory: [...storyHistory],
      choiceHistory: [...choiceHistory],
      currentScene
    };
  }

  /**
   * Regenerate the initial story segment from a custom scene description with streaming
   */
  static async regenerateCustomInitialStoryStream(
    config: AIConfig,
    sceneDescription: string,
    onChunk: (text: string) => void,
    samplerSettings?: import('../types').SamplerSettings,
    onThinkingChunk?: (text: string) => void
  ): Promise<StorySegment & { thinkingContent?: string; ttfs?: number }> {
    // Use slightly higher temperature for regeneration to get different results
    const regenerationSettings: import('../types').SamplerSettings = {
      temperature: Math.min((samplerSettings?.temperature ?? 0.8) + 0.1, 1.0),
      minP: samplerSettings?.minP ?? 0.05,
      repetitionPenalty: samplerSettings?.repetitionPenalty ?? 1.1,
      enableStreaming: samplerSettings?.enableStreaming
    };
    
    return this.generateCustomInitialStoryStream(config, sceneDescription, onChunk, regenerationSettings, onThinkingChunk);
  }

  /**
   * Regenerate the initial story segment from a custom scene description
   */
  static async regenerateCustomInitialStory(
    config: AIConfig,
    sceneDescription: string,
    samplerSettings?: import('../types').SamplerSettings
  ): Promise<StorySegment> {
    // Use slightly higher temperature for regeneration to get different results
    const regenerationSettings: import('../types').SamplerSettings = {
      temperature: Math.min((samplerSettings?.temperature ?? 0.8) + 0.1, 1.0),
      minP: samplerSettings?.minP ?? 0.05,
      repetitionPenalty: samplerSettings?.repetitionPenalty ?? 1.1,
      enableStreaming: samplerSettings?.enableStreaming
    };
    
    return this.generateCustomInitialStory(config, sceneDescription, regenerationSettings);
  }

  /**
   * Regenerate story continuation based on a user's custom action with streaming
   */
  static async regenerateCustomStoryStream(
    config: AIConfig,
    customAction: string,
    context: StoryContext,
    onChunk: (text: string) => void,
    samplerSettings?: import('../types').SamplerSettings,
    onThinkingChunk?: (text: string) => void
  ): Promise<StorySegment & { thinkingContent?: string; ttfs?: number }> {
    // Use slightly higher temperature for regeneration to get different results
    const regenerationSettings: import('../types').SamplerSettings = {
      temperature: Math.min((samplerSettings?.temperature ?? 0.8) + 0.1, 1.0),
      minP: samplerSettings?.minP ?? 0.05,
      repetitionPenalty: samplerSettings?.repetitionPenalty ?? 1.1,
      enableStreaming: samplerSettings?.enableStreaming
    };
    
    return this.continueCustomStoryStream(config, customAction, context, onChunk, regenerationSettings, onThinkingChunk);
  }

  /**
   * Regenerate story continuation based on a user's custom action
   */
  static async regenerateCustomStory(
    config: AIConfig,
    customAction: string,
    context: StoryContext,
    samplerSettings?: import('../types').SamplerSettings
  ): Promise<StorySegment> {
    // Use slightly higher temperature for regeneration to get different results
    const regenerationSettings: import('../types').SamplerSettings = {
      temperature: Math.min((samplerSettings?.temperature ?? 0.8) + 0.1, 1.0),
      minP: samplerSettings?.minP ?? 0.05,
      repetitionPenalty: samplerSettings?.repetitionPenalty ?? 1.1,
      enableStreaming: samplerSettings?.enableStreaming
    };
    
    return this.continueCustomStory(config, customAction, context, regenerationSettings);
  }

  /**
   * Try to parse custom story response using fallback methods when standard parsing fails
   */
  private static tryFallbackParsing(response: string): StorySegment | null {
    try {
      // Remove any leading/trailing whitespace
      const trimmed = response.trim();
      
      // If the response is just plain text without formatting, treat it as story content
      if (trimmed.length > 50 && !trimmed.includes('STORY:') && !trimmed.includes('SCENE:')) {
        return {
          id: this.generateId(),
          text: trimmed,
          sceneDescription: 'A mysterious scene unfolds',
          choices: [] // Custom mode always has empty choices
        };
      }
      
      // Try to find story content without strict formatting
      const lines = trimmed.split('\n').filter(line => line.trim());
      const storyLines: string[] = [];
      let foundStorySection = false;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (!trimmedLine) continue;
        
        // Check if this looks like a story line (not a section header)
        if (!trimmedLine.match(/^(STORY|SCENE):/i)) { // Not a section header
          storyLines.push(trimmedLine);
          foundStorySection = true;
        }
      }
      
      if (foundStorySection && storyLines.length > 0) {
        const storyText = storyLines.join(' ').trim();
        if (storyText.length > 50) {
          return {
            id: this.generateId(),
            text: storyText,
            sceneDescription: 'A mysterious scene unfolds',
            choices: [] // Custom mode always has empty choices
          };
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Test custom story generation functionality
   */
  static async testCustomStoryGeneration(
    config: AIConfig,
    testScene: string = "You find yourself in a mysterious forest at twilight"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const testStory = await this.generateCustomInitialStory(config, testScene);
      
      if (!testStory.text || testStory.text.length < 50) {
        return { success: false, error: 'Generated story too short or empty' };
      }

      if (testStory.choices.length !== 0) {
        return { success: false, error: 'Custom story should not include choices' };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof AIServiceError 
        ? error.message 
        : 'Unknown custom story generation error';
      return { success: false, error: message };
    }
  }
}
