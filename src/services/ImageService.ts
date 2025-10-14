import { AIService, AIServiceError } from './AIService';
import type { AIConfig } from '../types';

/**
 * Image generation prompts and templates
 */
class ImagePrompts {
  /**
   * System prompt for image generation
   */
  static readonly IMAGE_SYSTEM_PROMPT = `You are an AI assistant that creates detailed image prompts for DALL-E style image generation. Your role is to:

1. Create vivid, detailed visual descriptions
2. Focus on atmosphere, lighting, and composition
3. Include artistic style and mood descriptors
4. Keep prompts concise but descriptive (under 200 words)
5. Avoid text or writing in images

Guidelines:
- Use descriptive adjectives for mood and atmosphere
- Include lighting conditions (dramatic, soft, golden hour, etc.)
- Specify artistic style when appropriate (realistic, fantasy art, etc.)
- Focus on visual elements that enhance the story mood
- Avoid including people's faces in detail to maintain mystery`;

  /**
   * Generate scene image prompt from story description
   */
  static generateScenePrompt(sceneDescription: string, storyContext?: string): string {
    // Only use story context if it doesn't contain choices
    let cleanContext = '';
    if (storyContext) {
      // Remove choices and focus on narrative elements
      const choicePatterns = [
        'Do you:',
        'What do you do?',
        'Your options are:',
        'Choose your action:',
        'You can:',
        'Your choices:',
        '1. **',
        '2. **',
        '3. **',
        '4. **'
      ];
      
      let cleanText = storyContext;
      for (const pattern of choicePatterns) {
        const index = cleanText.indexOf(pattern);
        if (index !== -1) {
          cleanText = cleanText.substring(0, index).trim();
          break;
        }
      }
      
      if (cleanText.length > 50) { // Only use if we have meaningful context
        cleanContext = `\n\nNarrative context: ${cleanText.substring(0, 200)}...`;
      }
    }
    
    return `Create a detailed image prompt for this scene: "${sceneDescription}"${cleanContext}

Requirements:
- Focus on the environment, atmosphere, and mood
- Include lighting and weather conditions if relevant
- Specify artistic style (realistic, fantasy, cinematic, etc.)
- Keep the prompt under 200 words
- Make it visually compelling and atmospheric
- DO NOT include any choices, options, or decision text
- Focus purely on the visual scene description

Format your response as a single paragraph image prompt suitable for DALL-E or similar image generation models.`;
  }

  /**
   * Generate item/character image prompt
   */
  static generateItemPrompt(itemDescription: string, context?: string): string {
    const contextHint = context ? `\n\nContext: ${context.substring(0, 200)}...` : '';
    
    return `Create a detailed image prompt for this item or character: "${itemDescription}"${contextHint}

Requirements:
- Focus on visual details, textures, and materials
- Include appropriate lighting and background
- Specify artistic style and mood
- Keep the prompt under 150 words
- Make it visually interesting and detailed

Format your response as a single paragraph image prompt suitable for DALL-E or similar image generation models.`;
  }
}

/**
 * Service for AI-powered image generation
 * Handles scene and item image creation with error handling and retry logic
 */
export class ImageService {
  private static readonly IMAGE_REQUEST_TIMEOUT = 60000; // 60 seconds for image generation
  private static readonly MAX_RETRIES = 2; // Fewer retries for image generation due to cost

  /**
   * Generate an image for a story scene
   */
  static async generateSceneImage(
    config: AIConfig,
    sceneDescription: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _storyContext?: string // Unused but kept for API compatibility
  ): Promise<string> {
    try {
      // Use the clean image prompt generation that focuses only on the scene
      const imagePrompt = await this.generateCleanImagePrompt(config, sceneDescription);
      
      // Then generate the actual image
      return await this.generateImage(config, imagePrompt);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to generate scene image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Generate an image for an item or character
   */
  static async generateItemImage(
    config: AIConfig,
    itemDescription: string,
    context?: string
  ): Promise<string> {
    try {
      // First, generate an optimized image prompt
      const imagePrompt = await this.generateItemImagePrompt(config, itemDescription, context);
      
      // Then generate the actual image
      return await this.generateImage(config, imagePrompt);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to generate item image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Generate scene image with retry functionality
   */
  static async generateSceneImageWithRetry(
    config: AIConfig,
    sceneDescription: string,
    storyContext?: string,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<string> {
    let lastError: AIServiceError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateSceneImage(config, sceneDescription, storyContext);
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

        // Wait before retrying (longer delay for image generation)
        await this.delay(Math.pow(2, attempt) * 2000);
      }
    }

    throw lastError!;
  }

  /**
   * Generate item image with retry functionality
   */
  static async generateItemImageWithRetry(
    config: AIConfig,
    itemDescription: string,
    context?: string,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<string> {
    let lastError: AIServiceError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateItemImage(config, itemDescription, context);
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
        await this.delay(Math.pow(2, attempt) * 2000);
      }
    }

    throw lastError!;
  }

  /**
   * Generate an optimized image prompt using AI (clean version without story context)
   */
  private static async generateCleanImagePrompt(
    config: AIConfig,
    sceneDescription: string
  ): Promise<string> {
    const cleanPrompt = `Create a detailed image prompt for this scene: "${sceneDescription}"

Requirements:
- Focus on the environment, atmosphere, and mood
- Include lighting and weather conditions if relevant
- Specify artistic style (realistic, fantasy, cinematic, etc.)
- Keep the prompt under 200 words
- Make it visually compelling and atmospheric
- DO NOT include any choices, options, or decision text
- Focus purely on the visual scene description

Format your response as a single paragraph image prompt suitable for DALL-E or similar image generation models.`;

    const messages = [
      AIService.createSystemMessage(ImagePrompts.IMAGE_SYSTEM_PROMPT),
      AIService.createUserMessage(cleanPrompt)
    ];

    try {
      const { response } = await AIService.chatCompletionWithRetry(config, messages, {
        temperature: 0.8,
        maxTokens: 300
      });

      return response.trim();
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to generate image prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }



  /**
   * Generate an optimized item image prompt using AI
   */
  private static async generateItemImagePrompt(
    config: AIConfig,
    itemDescription: string,
    context?: string
  ): Promise<string> {
    const messages = [
      AIService.createSystemMessage(ImagePrompts.IMAGE_SYSTEM_PROMPT),
      AIService.createUserMessage(ImagePrompts.generateItemPrompt(itemDescription, context))
    ];

    try {
      const { response } = await AIService.chatCompletionWithRetry(config, messages, {
        temperature: 0.8,
        maxTokens: 250
      });

      return response.trim();
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to generate item image prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Generate an image using the AI service
   */
  private static async generateImage(config: AIConfig, prompt: string): Promise<string> {
    // Use image config if available, otherwise fall back to main config
    const imageApiKey = config.imageConfig?.apiKey || config.apiKey;
    const imageBaseUrl = config.imageConfig?.baseUrl || config.baseUrl;
    const imageProvider = config.imageConfig?.provider || 'openai';
    const imageModel = config.imageConfig?.model || config.model;
    
    // Different API endpoints and request formats based on provider
    let url: string;
    let requestBody: Record<string, unknown>;
    let headers: Record<string, string>;

    switch (imageProvider) {
      case 'nano-gpt': {
        url = `${imageBaseUrl}/api/generate-image`;
        requestBody = {
          prompt: prompt,
          model: imageModel,
          size: "1024x1024"
        };
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': imageApiKey
        };
        break;
      }
      
      case 'openai':
      default: {
        url = `${imageBaseUrl}/images/generations`;
        requestBody = {
          prompt: prompt,
          model: imageModel,
          n: 1,
          size: "1024x1024",
          response_format: "url"
        };
        headers = {
          'Authorization': `Bearer ${imageApiKey}`,
          'Content-Type': 'application/json'
        };
        break;
      }
    }

    try {
      const response = await this.makeImageRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.IMAGE_REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        throw await this.handleImageErrorResponse(response);
      }

      const data = await response.json();
      return this.parseImageResponse(data, imageProvider);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AIServiceError(
          'Network error: Unable to connect to image generation service',
          'NETWORK_ERROR'
        );
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIServiceError(
          'Request timeout: Image generation took too long',
          'TIMEOUT_ERROR'
        );
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AIServiceError(
        `Unexpected image generation error: ${errorMessage}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Make HTTP request for image generation
   */
  private static async makeImageRequest(url: string, options: RequestInit): Promise<Response> {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new AIServiceError(
          'Network error: Check your internet connection and image API endpoint',
          'NETWORK_ERROR'
        );
      }
      throw error;
    }
  }

  /**
   * Handle error responses from the image API
   */
  private static async handleImageErrorResponse(response: Response): Promise<AIServiceError> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode: AIServiceError['code'] = 'API_ERROR';
    let retryable = true;

    try {
      const errorData = await response.json();
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch {
      // Ignore JSON parsing errors for error responses
    }

    // Determine error type and retryability based on status code
    switch (response.status) {
      case 400:
        errorCode = 'API_ERROR';
        retryable = false;
        errorMessage = 'Invalid image generation request - check prompt content';
        break;
      case 401:
        errorCode = 'AUTH_ERROR';
        retryable = false;
        errorMessage = 'Invalid API key for image generation';
        break;
      case 403:
        errorCode = 'AUTH_ERROR';
        retryable = false;
        errorMessage = 'Access forbidden - check image generation permissions';
        break;
      case 429:
        errorCode = 'API_ERROR';
        retryable = true;
        errorMessage = 'Rate limit exceeded for image generation - please try again later';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorCode = 'API_ERROR';
        retryable = true;
        errorMessage = 'Image generation server error - please try again later';
        break;
    }

    return new AIServiceError(errorMessage, errorCode, retryable, response.status);
  }

  /**
   * Parse the image generation response from the API
   */
  private static parseImageResponse(data: unknown, provider: string = 'openai'): string {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format: expected object');
      }

      let imageUrl: string;

      switch (provider) {
        case 'nano-gpt': {
          // Nano-GPT can return images in different fields
          const dataObj = data as Record<string, unknown>;
          // Nano-GPT response handling
          
          if ('image' in dataObj && typeof dataObj.image === 'string') {
            imageUrl = dataObj.image;
          } else if ('imageDataUrl' in dataObj && typeof dataObj.imageDataUrl === 'string') {
            imageUrl = dataObj.imageDataUrl;
          } else if ('image_url' in dataObj && typeof dataObj.image_url === 'string') {
            imageUrl = dataObj.image_url;
          } else if ('url' in dataObj && typeof dataObj.url === 'string') {
            imageUrl = dataObj.url;
          } else if ('data' in dataObj && Array.isArray(dataObj.data) && dataObj.data.length > 0) {
            const firstImage = dataObj.data[0];
            if (firstImage && typeof firstImage === 'object' && firstImage !== null) {
              const imageObj = firstImage as Record<string, unknown>;
              // Try different possible field names for the image URL
              if ('url' in imageObj && typeof imageObj.url === 'string') {
                imageUrl = imageObj.url;
              } else if ('image' in imageObj && typeof imageObj.image === 'string') {
                imageUrl = imageObj.image;
              } else if ('imageDataUrl' in imageObj && typeof imageObj.imageDataUrl === 'string') {
                imageUrl = imageObj.imageDataUrl;
              } else if ('image_url' in imageObj && typeof imageObj.image_url === 'string') {
                imageUrl = imageObj.image_url;
              } else if ('b64_json' in imageObj && typeof imageObj.b64_json === 'string') {
                // Convert base64 to data URL
                imageUrl = `data:image/jpeg;base64,${imageObj.b64_json}`;
              } else {
                throw new Error(`Invalid nano-gpt data item format: no image URL found. Available fields: ${Object.keys(imageObj).join(', ')}`);
              }
            } else {
              throw new Error('Invalid nano-gpt response format: no image URL found');
            }
          } else {
            console.error('Available fields in nano-gpt response:', Object.keys(dataObj));
            throw new Error(`Invalid nano-gpt response format: no image URL found. Available fields: ${Object.keys(dataObj).join(', ')}`);
          }
          break;
        }

        case 'openai':
        default: {
          if (!('data' in data) || !Array.isArray((data as { data: unknown }).data)) {
            throw new Error('Invalid OpenAI response format: expected data array');
          }

          const responseData = (data as { data: unknown[] }).data;
          
          if (responseData.length === 0) {
            throw new Error('No images returned from OpenAI service');
          }

          const firstImage = responseData[0];
          if (!firstImage || typeof firstImage !== 'object' || !('url' in firstImage)) {
            throw new Error('Invalid OpenAI image format: expected url property');
          }

          imageUrl = (firstImage as { url: unknown }).url as string;
          break;
        }
      }

      if (typeof imageUrl !== 'string' || (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:'))) {
        throw new Error('Invalid image URL format: expected valid HTTP URL or data URL');
      }

      return imageUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
      throw new AIServiceError(
        `Failed to parse ${provider} image response: ${errorMessage}`,
        'PARSE_ERROR',
        false
      );
    }
  }

  /**
   * Test image generation functionality
   */
  static async testImageGeneration(config: AIConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const testImageUrl = await this.generateImage(config, "A simple test image of a peaceful landscape");
      
      if (!testImageUrl || !testImageUrl.startsWith('http')) {
        return { success: false, error: 'Generated image URL is invalid' };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof AIServiceError 
        ? error.message 
        : 'Unknown image generation error';
      return { success: false, error: message };
    }
  }

  /**
   * Get the effective image configuration (with fallbacks)
   */
  static getEffectiveImageConfig(config: AIConfig): { apiKey: string; baseUrl: string; model: string } {
    return {
      apiKey: config.imageConfig?.apiKey || config.apiKey,
      baseUrl: config.imageConfig?.baseUrl || config.baseUrl,
      model: config.imageConfig?.model || config.model
    };
  }

  /**
   * Utility function for delays in retry logic
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate image generation parameters
   */
  static validateImageParams(description: string): boolean {
    return (
      typeof description === 'string' &&
      description.trim().length > 10 &&
      description.length < 1000
    );
  }

  /**
   * Create a fallback image URL for when generation fails
   */
  static createFallbackImageUrl(sceneDescription: string): string {
    // Create a simple placeholder image URL based on scene description
    const encodedDescription = encodeURIComponent(sceneDescription.substring(0, 50));
    return `https://via.placeholder.com/512x512/4a5568/ffffff?text=${encodedDescription}`;
  }
}