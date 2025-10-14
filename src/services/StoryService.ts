import { AIService, AIServiceError } from './AIService';
import { TokenManager } from '../utils/TokenManager';
import { ThinkingParser } from '../utils/ThinkingParser';
import type { AIConfig, StorySegment, Choice, StoryContext } from '../types';

/**
 * Story generation prompts and templates
 */
class StoryPrompts {
  /**
   * System prompt for story generation
   */
  static readonly STORY_SYSTEM_PROMPT = `You are a creative storyteller for an interactive Choose Your Own Adventure game. Your role is to:

1. Create engaging, immersive narratives with vivid descriptions
2. Maintain narrative continuity and consistency
3. Keep responses SHORT, CONCISE, but descriptive (2 paragraphs max)
4. Always end with a clear situation that requires a decision
5. NEVER include choices or options in the STORY section

Guidelines:
- Write in second person ("You...")
- Each story segment should advance the plot meaningfully
- The STORY section should contain ONLY narrative text
- The SCENE section should contain ONLY visual scene description
- DO NOT include "Do you:", choices, or options in the STORY section
- Choices will be generated separately in a different step`;

  /**
   * Generate initial story prompt
   */
  static generateInitialStoryPrompt(includeScene: boolean = true): string {
    const sceneRequirement = includeScene ? '\n- Include a brief scene description for potential image generation' : '\n- Do NOT include any scene descriptions or SCENE: sections';
    const sceneFormat = includeScene ? '\nSCENE: [Brief visual description of the current scene for image generation]' : '';
    const sceneInstruction = includeScene ? '' : '\n\nIMPORTANT: Do NOT include a SCENE section in your response. Only provide STORY and CHOICES sections.';
    
    const prompt = `Create the opening scene for a new Choose Your Own Adventure story. 

Requirements:
- Set up an intriguing premise and setting
- Introduce the main character (the player)
- Create an engaging hook that draws the reader in
- End with a situation that requires a decision${sceneRequirement}

Format your response as:
STORY: [The narrative text - NO choices, NO "Do you:" text, ONLY story narrative]${sceneFormat}
CHOICES: [3-4 numbered choices, each on a new line]

IMPORTANT: The STORY section must contain ONLY narrative text. Do not include any choices, options, or "Do you:" prompts in the STORY section. Put all choices in the separate CHOICES section.${sceneInstruction}`;

    // Ensure we don't exceed token limits
    return TokenManager.truncateToTokenLimit(prompt);
  }

  /**
   * Generate story continuation prompt
   */
  static generateContinuationPrompt(choice: Choice, context: StoryContext, includeScene: boolean = true): string {
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
      5500 // Leave room for system prompt, user choice, and response
    );

    const sceneRequirement = includeScene ? '\n- Include a scene description for image generation' : '\n- Do NOT include any scene descriptions or SCENE: sections';
    const sceneFormat = includeScene ? '\nSCENE: [Brief visual description of the new scene for image generation]' : '';
    const sceneInstruction = includeScene ? '' : '\n\nIMPORTANT: Do NOT include a SCENE section in your response. Only provide STORY and CHOICES sections.';

    const prompt = `Continue the story based on the player's choice: "${choice.text}"

IMMEDIATE CONTEXT:
Previous segment: ${previousSegment || 'None'}
Previous action: ${previousAction || 'None'}
Current scene: ${context.currentScene}

STORY HISTORY (${segmentsIncluded} segments, ${choicesIncluded} actions included):
${contextText}

Requirements:
- Show the consequences of the player's choice
- Advance the story meaningfully from the previous segment
- Maintain consistency with previous events and the established narrative
- Create a new situation requiring a decision${sceneRequirement}

Format your response as:
STORY: [The narrative text showing consequences and new developments - NO choices, NO "Do you:" text]${sceneFormat}
CHOICES: [3-4 numbered choices, each on a new line]

IMPORTANT: The STORY section must contain ONLY narrative text. Do not include any choices, options, or "Do you:" prompts in the STORY section. Put all choices in the separate CHOICES section.${sceneInstruction}`;

    // Final safety check - truncate if still too long
    return TokenManager.truncateToTokenLimit(prompt);
  }

  /**
   * Generate choices prompt
   */
  static generateChoicesPrompt(storyText: string, sceneDescription: string): string {
    return `Based on the current story situation, generate 3-4 meaningful choices for the player.

Current story: ${storyText.substring(0, 500)}...
Current scene: ${sceneDescription}

Requirements:
- Each choice should lead to different story outcomes
- Choices should be specific and actionable
- Avoid generic options like "Go left" or "Go right"
- Make choices feel consequential and interesting
- Keep each choice to 1-2 sentences maximum

Format your response as a numbered list:
1. [First choice option]
2. [Second choice option]
3. [Third choice option]
4. [Fourth choice option (if applicable)]`;
  }
}

/**
 * Service for AI-powered narrative generation
 * Handles story creation, continuation, and choice generation
 */
export class StoryService {
  /**
   * Generate the initial story segment for a new adventure with streaming
   */
  static async generateInitialStoryStream(
    config: AIConfig,
    onChunk: (text: string) => void,
    samplerSettings?: import('../types').SamplerSettings,
    onThinkingChunk?: (text: string) => void
  ): Promise<StorySegment & { thinkingContent?: string }> {
    const includeScene = config.enableImageGeneration !== false;
    const messages = [
      AIService.createSystemMessage(StoryPrompts.STORY_SYSTEM_PROMPT),
      AIService.createUserMessage(StoryPrompts.generateInitialStoryPrompt(includeScene))
    ];

    try {
      const { response, thinkingContent, ttfs } = await AIService.chatCompletionStream(config, messages, onChunk, {
        temperature: samplerSettings?.temperature ?? 0.8,
        maxTokens: 2048,
        onThinkingChunk
      });

      const storySegment = this.parseStoryResponse(response, includeScene);
      return { ...storySegment, thinkingContent, ttfs };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to generate initial story: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Generate the initial story segment for a new adventure
   */
  static async generateInitialStory(config: AIConfig, samplerSettings?: import('../types').SamplerSettings): Promise<StorySegment> {
    const includeScene = config.enableImageGeneration !== false;
    const messages = [
      AIService.createSystemMessage(StoryPrompts.STORY_SYSTEM_PROMPT),
      AIService.createUserMessage(StoryPrompts.generateInitialStoryPrompt(includeScene))
    ];

    try {
      const response = await AIService.chatCompletionWithRetry(config, messages, {
        temperature: samplerSettings?.temperature ?? 0.8,
        maxTokens: 2048
      });

      return this.parseStoryResponse(response, includeScene);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to generate initial story: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Continue the story based on a user's choice with streaming
   */
  static async continueStoryStream(
    config: AIConfig,
    choice: Choice,
    context: StoryContext,
    onChunk: (text: string) => void,
    samplerSettings?: import('../types').SamplerSettings,
    onThinkingChunk?: (text: string) => void
  ): Promise<StorySegment & { thinkingContent?: string }> {
    const includeScene = config.enableImageGeneration !== false;
    const messages = [
      AIService.createSystemMessage(StoryPrompts.STORY_SYSTEM_PROMPT),
      AIService.createUserMessage(StoryPrompts.generateContinuationPrompt(choice, context, includeScene))
    ];

    try {
      const { response, thinkingContent, ttfs } = await AIService.chatCompletionStream(config, messages, onChunk, {
        temperature: samplerSettings?.temperature ?? 0.8,
        maxTokens: 2048,
        onThinkingChunk
      });

      const storySegment = this.parseStoryResponse(response, includeScene);
      
      // If no choices were parsed from the response, generate them separately (fallback)
      // This happens AFTER the first API call is complete
      if (storySegment.choices.length === 0) {
        const choices = await this.generateChoices(config, storySegment.text, storySegment.sceneDescription, samplerSettings);
        storySegment.choices = choices;
      }

      return { ...storySegment, thinkingContent, ttfs };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to continue story: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Continue the story based on a user's choice
   */
  static async continueStory(
    config: AIConfig,
    choice: Choice,
    context: StoryContext,
    samplerSettings?: import('../types').SamplerSettings
  ): Promise<StorySegment> {
    const includeScene = config.enableImageGeneration !== false;
    const messages = [
      AIService.createSystemMessage(StoryPrompts.STORY_SYSTEM_PROMPT),
      AIService.createUserMessage(StoryPrompts.generateContinuationPrompt(choice, context, includeScene))
    ];

    try {
      const response = await AIService.chatCompletionWithRetry(config, messages, {
        temperature: samplerSettings?.temperature ?? 0.8,
        maxTokens: 2048
      });

      const storySegment = this.parseStoryResponse(response, includeScene);
      
      // If no choices were parsed from the response, generate them separately (fallback)
      // This happens AFTER the first API call is complete
      if (storySegment.choices.length === 0) {
        const choices = await this.generateChoices(config, storySegment.text, storySegment.sceneDescription, samplerSettings);
        storySegment.choices = choices;
      }

      return storySegment;
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to continue story: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Generate choices for a given story context
   */
  static async generateChoices(
    config: AIConfig,
    storyText: string,
    sceneDescription: string,
    samplerSettings?: import('../types').SamplerSettings
  ): Promise<Choice[]> {
    const messages = [
      AIService.createSystemMessage(StoryPrompts.STORY_SYSTEM_PROMPT),
      AIService.createUserMessage(StoryPrompts.generateChoicesPrompt(storyText, sceneDescription))
    ];

    try {
      const response = await AIService.chatCompletionWithRetry(config, messages, {
        temperature: samplerSettings?.temperature ?? 0.7,
        maxTokens: 400
      });

      return this.parseChoicesResponse(response);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to generate choices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Generate initial story with retry functionality
   */
  static async generateInitialStoryWithRetry(
    config: AIConfig,
    maxRetries: number = 3,
    samplerSettings?: import('../types').SamplerSettings
  ): Promise<StorySegment> {
    let lastError: AIServiceError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const storySegment = await this.generateInitialStory(config, samplerSettings);
        
        // If no choices were parsed from the response, generate them separately (fallback)
        if (storySegment.choices.length === 0) {
          const choices = await this.generateChoices(config, storySegment.text, storySegment.sceneDescription, samplerSettings);
          storySegment.choices = choices;
        }

        return storySegment;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        lastError = error instanceof AIServiceError ? error : new AIServiceError(
          `Attempt ${attempt} failed: ${errorMessage}`,
          'API_ERROR'
        );

        // Don't retry on non-retryable errors
        if (!lastError.retryable) {
          throw lastError;
        }

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retrying
        await this.delay(Math.pow(2, attempt - 1) * 1000);
      }
    }

    throw lastError!;
  }

  /**
   * Parse story response from AI service
   */
  private static parseStoryResponse(response: string, includeScene: boolean = true): StorySegment {
    try {
      // First, extract and remove any thinking content
      const { cleanedResponse } = ThinkingParser.parseThinkingResponse(response);
      
      const storyMatch = cleanedResponse.match(/STORY:\s*(.*?)(?=\n\s*\*?\*?SCENE:?|\n\s*\*?\*?CHOICES:?|$)/is);
      const sceneMatch = cleanedResponse.match(/\*?\*?SCENE:\s*(.*?)(?=\n\s*\*?\*?CHOICES:?|$)/is);
      const choicesMatch = cleanedResponse.match(/\*?\*?CHOICES:?\*?\*?\s*(.*?)$/is);



      if (!storyMatch || !storyMatch[1]) {
        // Try alternative parsing - maybe the AI didn't use the expected format
        const fallbackStory = this.tryFallbackParsing(cleanedResponse);
        if (fallbackStory) {
          return fallbackStory;
        }
        
        // Provide specific error message based on the issue
        let errorMessage = 'No story content found in response';
        if (response.includes('<think>') && !response.includes('</think>')) {
          errorMessage = 'AI response appears to be incomplete (truncated thinking). Try again or check your token limits.';
        } else if (response.length < 50) {
          errorMessage = 'AI response too short. The model may not be responding properly.';
        } else if (!response.includes('STORY:')) {
          errorMessage = 'AI response missing expected format. The model may not be following instructions.';
        }
        
        throw new Error(errorMessage);
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

      // Parse choices if present
      let choices: Choice[] = [];
      if (choicesMatch && choicesMatch[1]) {
        choices = this.parseChoicesFromText(choicesMatch[1].trim());
      }

      return {
        id: this.generateId(),
        text: storyText,
        sceneDescription,
        choices
      };
    } catch (error) {
      throw new AIServiceError(
        `Failed to parse story response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR',
        false
      );
    }
  }

  /**
   * Parse choices response from AI service
   */
  private static parseChoicesResponse(response: string): Choice[] {
    try {
      const choices: Choice[] = [];
      const lines = response.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const match = line.match(/^\d+\.\s*(.+)$/);
        if (match && match[1]) {
          const choiceText = match[1].trim();
          if (choiceText.length > 10) { // Ensure meaningful choices
            choices.push({
              id: this.generateId(),
              text: choiceText
            });
          }
        }
      }

      if (choices.length < 2) {
        throw new Error('Not enough valid choices generated');
      }

      // Limit to maximum 4 choices
      return choices.slice(0, 4);
    } catch (error) {
      throw new AIServiceError(
        `Failed to parse choices response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR',
        false
      );
    }
  }

  /**
   * Generate a unique ID for story segments and choices
   */
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Parse choices from text format
   */
  private static parseChoicesFromText(choicesText: string): Choice[] {
    const choices: Choice[] = [];
    const lines = choicesText.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const trimmedLine = line.trim();
      // Match numbered choices like "1. Choice text" or "1) Choice text"
      const match = trimmedLine.match(/^\d+[.)]\s*(.+)$/);
      if (match && match[1]) {
        choices.push({
          id: this.generateId(),
          text: match[1].trim()
        });
      } else if (trimmedLine.length > 0) {
        // Fallback: treat any non-empty line as a choice
        choices.push({
          id: this.generateId(),
          text: trimmedLine
        });
      }
    }

    return choices;
  }

  /**
   * Try to parse story response using fallback methods when standard parsing fails
   */
  private static tryFallbackParsing(response: string): StorySegment | null {
    try {
      // Remove any leading/trailing whitespace
      const trimmed = response.trim();
      
      // If response is empty or too short, can't parse
      if (trimmed.length < 20) {
        return null;
      }
      
      // If the response is just plain text without formatting, treat it as story content
      if (trimmed.length > 50 && !trimmed.includes('STORY:') && !trimmed.includes('CHOICES:') && !trimmed.includes('CHOICES') && !trimmed.includes('**CHOICES')) {
        return {
          id: this.generateId(),
          text: trimmed,
          sceneDescription: 'A mysterious scene unfolds',
          choices: [] // Will be generated separately if needed
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
        
        // Check if this looks like a story line (not a choice or section header)
        if (!trimmedLine.match(/^\d+\./) && // Not a numbered choice
            !trimmedLine.match(/^\*?\*?(STORY|SCENE|CHOICES):?\*?\*?/i) && // Not a section header (with optional colon and bold)
            !trimmedLine.match(/^(Do you|What do you|Your options|Choose)/i)) { // Not choice prompts
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
            choices: [] // Will be generated separately if needed
          };
        }
      }
      
      // Last resort: if we have any text that looks like narrative, use it
      if (trimmed.length > 20) {
        const narrativePatterns = [
          /You\s+(?:are|find|see|hear|feel|walk|run|stand|sit|look)\s+.*$/im,
          /The\s+.*$/im,
          /A\s+.*$/im,
          /As\s+you\s+.*$/im
        ];
        
        for (const pattern of narrativePatterns) {
          const match = trimmed.match(pattern);
          if (match && match[0] && match[0].length > 50) {
            return {
              id: this.generateId(),
              text: match[0].trim(),
              sceneDescription: 'A mysterious scene unfolds',
              choices: [] // Will be generated separately if needed
            };
          }
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Utility function for delays in retry logic
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
   * Regenerate the initial story segment with streaming
   */
  static async regenerateInitialStoryStream(
    config: AIConfig,
    onChunk: (text: string) => void,
    samplerSettings?: import('../types').SamplerSettings,
    onThinkingChunk?: (text: string) => void
  ): Promise<StorySegment & { thinkingContent?: string; ttfs?: number }> {
    // Use slightly higher temperature for regeneration to get different results
    const regenerationSettings: import('../types').SamplerSettings = {
      temperature: Math.min((samplerSettings?.temperature ?? 0.7) + 0.1, 1.0),
      minP: samplerSettings?.minP ?? 0.05,
      repetitionPenalty: samplerSettings?.repetitionPenalty ?? 1.1,
      enableStreaming: samplerSettings?.enableStreaming
    };
    
    return this.generateInitialStoryStream(config, onChunk, regenerationSettings, onThinkingChunk);
  }

  /**
   * Regenerate the initial story segment
   */
  static async regenerateInitialStory(
    config: AIConfig,
    samplerSettings?: import('../types').SamplerSettings
  ): Promise<StorySegment> {
    // Use slightly higher temperature for regeneration to get different results
    const regenerationSettings: import('../types').SamplerSettings = {
      temperature: Math.min((samplerSettings?.temperature ?? 0.7) + 0.1, 1.0),
      minP: samplerSettings?.minP ?? 0.05,
      repetitionPenalty: samplerSettings?.repetitionPenalty ?? 1.1,
      enableStreaming: samplerSettings?.enableStreaming
    };
    
    return this.generateInitialStory(config, regenerationSettings);
  }

  /**
   * Regenerate story continuation with streaming
   */
  static async regenerateStoryStream(
    config: AIConfig,
    choice: Choice,
    context: StoryContext,
    onChunk: (text: string) => void,
    samplerSettings?: import('../types').SamplerSettings,
    onThinkingChunk?: (text: string) => void
  ): Promise<StorySegment & { thinkingContent?: string; ttfs?: number }> {
    // Use slightly higher temperature for regeneration to get different results
    const regenerationSettings: import('../types').SamplerSettings = {
      temperature: Math.min((samplerSettings?.temperature ?? 0.7) + 0.1, 1.0),
      minP: samplerSettings?.minP ?? 0.05,
      repetitionPenalty: samplerSettings?.repetitionPenalty ?? 1.1,
      enableStreaming: samplerSettings?.enableStreaming
    };
    
    return this.continueStoryStream(config, choice, context, onChunk, regenerationSettings, onThinkingChunk);
  }

  /**
   * Regenerate story continuation
   */
  static async regenerateStory(
    config: AIConfig,
    choice: Choice,
    context: StoryContext,
    samplerSettings?: import('../types').SamplerSettings
  ): Promise<StorySegment> {
    // Use slightly higher temperature for regeneration to get different results
    const regenerationSettings: import('../types').SamplerSettings = {
      temperature: Math.min((samplerSettings?.temperature ?? 0.7) + 0.1, 1.0),
      minP: samplerSettings?.minP ?? 0.05,
      repetitionPenalty: samplerSettings?.repetitionPenalty ?? 1.1,
      enableStreaming: samplerSettings?.enableStreaming
    };
    
    return this.continueStory(config, choice, context, regenerationSettings);
  }

  /**
   * Test story generation functionality
   */
  static async testStoryGeneration(config: AIConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const testStory = await this.generateInitialStory(config);
      
      if (!testStory.text || testStory.text.length < 50) {
        return { success: false, error: 'Generated story too short or empty' };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof AIServiceError 
        ? error.message 
        : 'Unknown story generation error';
      return { success: false, error: message };
    }
  }
}