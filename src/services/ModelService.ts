import type { AIConfig, ModelInfo } from '../types';

/**
 * Error types for model service operations
 */
export class ModelServiceError extends Error {
  public readonly code: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'API_ERROR' | 'PARSE_ERROR';
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'API_ERROR' | 'PARSE_ERROR',
    retryable: boolean = true
  ) {
    super(message);
    this.name = 'ModelServiceError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Service for fetching and managing AI models from OpenAI-compatible endpoints
 */
export class ModelService {
  private static readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  private static readonly MAX_RETRIES = 3;

  /**
   * Fetch available models from the API endpoint
   */
  static async fetchAvailableModels(config: AIConfig): Promise<ModelInfo[]> {
    if (!config.apiKey || !config.baseUrl) {
      throw new ModelServiceError(
        'API key and base URL are required',
        'API_ERROR',
        false
      );
    }

    // Anthropic doesn't have a models endpoint - return predefined list
    if (config.baseUrl.includes('api.anthropic.com')) {
      return [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest)', description: 'Most intelligent model' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Powerful model for complex tasks' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balanced performance' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fast and efficient' }
      ];
    }

    // Use proxy for OpenAI API to avoid CORS issues
    let url = `${config.baseUrl}/models`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (config.baseUrl.includes('api.openai.com')) {
      url = '/api/openai/v1/models';
    }
    
    try {
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return this.parseModelsResponse(data);
    } catch (error) {
      if (error instanceof ModelServiceError) {
        throw error;
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ModelServiceError(
          'Network error: Unable to connect to API endpoint',
          'NETWORK_ERROR'
        );
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ModelServiceError(
          'Request timeout: API took too long to respond',
          'NETWORK_ERROR'
        );
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ModelServiceError(
        `Unexpected error: ${errorMessage}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Validate that a specific model is available and accessible
   */
  static async validateModelAccess(config: AIConfig, modelId: string): Promise<boolean> {
    try {
      const models = await this.fetchAvailableModels(config);
      return models.some(model => model.id === modelId);
    } catch {
      // If we can't fetch models, we can't validate access
      return false;
    }
  }

  /**
   * Get model information for a specific model ID
   */
  static async getModelInfo(config: AIConfig, modelId: string): Promise<ModelInfo | null> {
    try {
      const models = await this.fetchAvailableModels(config);
      return models.find(model => model.id === modelId) || null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch models with manual retry functionality
   */
  static async fetchModelsWithRetry(
    config: AIConfig,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<ModelInfo[]> {
    let lastError: ModelServiceError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.fetchAvailableModels(config);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        lastError = error instanceof ModelServiceError ? error : new ModelServiceError(
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

        // Wait before retrying (exponential backoff)
        await this.delay(Math.pow(2, attempt - 1) * 1000);
      }
    }

    throw lastError!;
  }

  /**
   * Test API connectivity without fetching full model list
   */
  static async testConnection(config: AIConfig): Promise<{ success: boolean; error?: string }> {
    try {
      await this.fetchAvailableModels(config);
      return { success: true };
    } catch (error) {
      const message = error instanceof ModelServiceError 
        ? error.message 
        : 'Unknown connection error';
      return { success: false, error: message };
    }
  }

  /**
   * Make HTTP request with proper error handling
   */
  private static async makeRequest(url: string, options: RequestInit): Promise<Response> {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new ModelServiceError(
          'Network error: Check your internet connection and API endpoint, If running local ensure CORS is enabled.',
          'NETWORK_ERROR'
        );
      }
      throw error;
    }
  }

  /**
   * Handle error responses from the API
   */
  private static async handleErrorResponse(response: Response): Promise<ModelServiceError> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode: ModelServiceError['code'] = 'API_ERROR';
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
      case 401:
        errorCode = 'AUTH_ERROR';
        retryable = false;
        errorMessage = 'Invalid API key or unauthorized access';
        break;
      case 403:
        errorCode = 'AUTH_ERROR';
        retryable = false;
        errorMessage = 'Access forbidden - check your API key permissions';
        break;
      case 404:
        errorCode = 'API_ERROR';
        retryable = false;
        errorMessage = 'API endpoint not found - check your base URL';
        break;
      case 429:
        errorCode = 'API_ERROR';
        retryable = true;
        errorMessage = 'Rate limit exceeded - please try again later';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorCode = 'API_ERROR';
        retryable = true;
        errorMessage = 'Server error - please try again later';
        break;
    }

    return new ModelServiceError(errorMessage, errorCode, retryable);
  }

  /**
   * Parse the models response from the API
   */
  private static parseModelsResponse(data: unknown): ModelInfo[] {
    try {
      if (!data || typeof data !== 'object' || !('data' in data) || !Array.isArray((data as { data: unknown }).data)) {
        throw new Error('Invalid response format: expected data array. Are you using /v1 at the end of the url?');
      }

      const responseData = (data as { data: unknown[] }).data;
      return responseData
        .filter((model: unknown) => model && typeof model === 'object' && model !== null && 'id' in model && typeof (model as { id: unknown }).id === 'string')
        .map((model: unknown) => {
          const modelObj = model as { id: string; description?: string };
          return {
            id: modelObj.id,
            name: modelObj.id, // Use ID as name if no display name provided
            description: modelObj.description || undefined,
          };
        })
        .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
      throw new ModelServiceError(
        `Failed to parse models response: ${errorMessage}`,
        'PARSE_ERROR',
        false
      );
    }
  }

  /**
   * Utility function for delays in retry logic
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Filter models to only include text generation models
   * Excludes image generation and other specialized models
   */
  static filterTextModels(models: ModelInfo[]): ModelInfo[] {
    const textModelPatterns = [
      /^gpt/i,
      /^claude/i,
      /^llama/i,
      /^mistral/i,
      /^gemini/i,
      /text/i,
      /chat/i,
      /instruct/i
    ];

    const excludePatterns = [
      /dall-e/i,
      /whisper/i,
      /tts/i,
      /embedding/i,
      /moderation/i
    ];

    return models.filter(model => {
      // Exclude known non-text models
      if (excludePatterns.some(pattern => pattern.test(model.id))) {
        return false;
      }

      // Include known text models
      if (textModelPatterns.some(pattern => pattern.test(model.id))) {
        return true;
      }

      // Default to including unknown models
      return true;
    });
  }

  /**
   * Filter models to only include image generation models
   */
  static filterImageModels(models: ModelInfo[]): ModelInfo[] {
    const imageModelPatterns = [
      /^dall-e/i,
      /^midjourney/i,
      /stable.*diffusion/i,
      /^imagen/i,
      /^firefly/i,
      /flux/i,
      /playground/i,
      /^sd-/i,
      /^sdxl/i
    ];

    // More specific patterns for known image models
    const specificImageModels = [
      /^dall-e-2$/i,
      /^dall-e-3$/i,
      /^stable-diffusion/i,
      /^midjourney/i,
      /^flux-/i,
      /^playground-/i
    ];

    return models.filter(model => {
      // First check specific known image models
      if (specificImageModels.some(pattern => pattern.test(model.id))) {
        return true;
      }
      
      // Then check broader patterns, but exclude text models
      if (imageModelPatterns.some(pattern => pattern.test(model.id))) {
        // Exclude models that are clearly text models despite matching patterns
        const textModelExclusions = [
          /gpt/i,
          /llama/i,
          /claude/i,
          /mistral/i,
          /gemini/i,
          /chat/i,
          /instruct/i,
          /text/i,
          /70b/i,
          /13b/i,
          /7b/i,
          /\d+b/i // Exclude models with parameter counts like "70B"
        ];
        
        if (textModelExclusions.some(pattern => pattern.test(model.id))) {
          return false;
        }
        
        return true;
      }
      
      return false;
    });
  }

  /**
   * Fetch available image models using image configuration
   */
  static async fetchAvailableImageModels(config: AIConfig): Promise<ModelInfo[]> {
    // For nano-gpt provider, don't try to fetch models - they don't have a models endpoint
    // and it causes CORS issues. Return empty array to trigger manual model entry.
    if (config.imageConfig?.provider === 'nano-gpt') {
      console.log('Nano-GPT provider detected - skipping model fetching (manual entry required)');
      return [];
    }

    // Use image config if available, otherwise fall back to main config
    const imageConfig = config.imageConfig ? {
      apiKey: config.imageConfig.apiKey || config.apiKey,
      baseUrl: config.imageConfig.baseUrl || config.baseUrl,
      model: config.imageConfig.model,
      availableModels: config.imageConfig.availableModels
    } : config;

    const allModels = await this.fetchAvailableModels(imageConfig);
    const filteredModels = this.filterImageModels(allModels);
    
    // If no image models found with filtering, log all models for debugging
    if (filteredModels.length === 0) {
      console.log('No image models found after filtering. All available models:', allModels.map(m => m.id));
    }
    
    return filteredModels;
  }

  /**
   * Fetch image models with manual retry functionality
   */
  static async fetchImageModelsWithRetry(
    config: AIConfig,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<ModelInfo[]> {
    let lastError: ModelServiceError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.fetchAvailableImageModels(config);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        lastError = error instanceof ModelServiceError ? error : new ModelServiceError(
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

        // Wait before retrying (exponential backoff)
        await this.delay(Math.pow(2, attempt - 1) * 1000);
      }
    }

    throw lastError!;
  }

  /**
   * Test image API connectivity
   */
  static async testImageConnection(config: AIConfig): Promise<{ success: boolean; error?: string }> {
    // For nano-gpt provider, we can't test via models endpoint due to CORS and lack of endpoint
    // Just return success if the configuration looks valid
    if (config.imageConfig?.provider === 'nano-gpt') {
      const imageApiKey = config.imageConfig.apiKey || config.apiKey;
      const imageBaseUrl = config.imageConfig.baseUrl || config.baseUrl;
      
      if (!imageApiKey || !imageBaseUrl) {
        return { success: false, error: 'API key and base URL are required for nano-gpt' };
      }
      
      // Basic validation - we can't actually test the connection without making an image generation request
      return { success: true };
    }

    try {
      await this.fetchAvailableImageModels(config);
      return { success: true };
    } catch (error) {
      const message = error instanceof ModelServiceError 
        ? error.message 
        : 'Unknown connection error';
      return { success: false, error: message };
    }
  }

  /**
   * Fetch all available models without filtering (useful for debugging or services with non-standard naming)
   */
  static async fetchAllModelsForImageConfig(config: AIConfig): Promise<ModelInfo[]> {
    // For nano-gpt provider, don't try to fetch models - they don't have a models endpoint
    // and it causes CORS issues. Return empty array to trigger manual model entry.
    if (config.imageConfig?.provider === 'nano-gpt') {
      console.log('Nano-GPT provider detected - skipping model fetching (manual entry required)');
      return [];
    }

    // Use image config if available, otherwise fall back to main config
    const imageConfig = config.imageConfig ? {
      apiKey: config.imageConfig.apiKey || config.apiKey,
      baseUrl: config.imageConfig.baseUrl || config.baseUrl,
      model: config.imageConfig.model,
      availableModels: config.imageConfig.availableModels
    } : config;

    return await this.fetchAvailableModels(imageConfig);
  }
}