import type { AIConfig } from '../types';

/**
 * API key format validation functions
 */
export class APIKeyValidator {
  /**
   * Validate OpenAI API key format
   * OpenAI keys typically start with 'sk-' and are 51 characters long
   */
  static validateOpenAIKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') return false;
    
    // Remove whitespace
    const cleanKey = apiKey.trim();
    
    // Check OpenAI format: starts with 'sk-' and has reasonable length
    if (cleanKey.startsWith('sk-') && cleanKey.length >= 20) {
      return true;
    }
    
    return false;
  }

  /**
   * Validate generic API key format
   * More lenient validation for other OpenAI-compatible services
   */
  static validateGenericKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') return false;
    
    const cleanKey = apiKey.trim();
    
    // Basic validation: non-empty, reasonable length, no obvious invalid characters
    if (cleanKey.length >= 8 && cleanKey.length <= 200) {
      // Check for basic alphanumeric and common special characters
      const validPattern = /^[a-zA-Z0-9\-_.]+$/;
      return validPattern.test(cleanKey);
    }
    
    return false;
  }

  /**
   * Auto-detect and validate API key based on format
   */
  static validateAPIKey(apiKey: string): { isValid: boolean; type: 'openai' | 'generic' | 'invalid' } {
    if (this.validateOpenAIKey(apiKey)) {
      return { isValid: true, type: 'openai' };
    }
    
    if (this.validateGenericKey(apiKey)) {
      return { isValid: true, type: 'generic' };
    }
    
    return { isValid: false, type: 'invalid' };
  }
}

/**
 * URL validation utilities
 */
export class URLValidator {
  /**
   * Validate API base URL format
   */
  static validateBaseURL(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url.trim());
      
      // Must be HTTP or HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      
      // Must have a valid hostname
      if (!urlObj.hostname) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize base URL (ensure it ends properly)
   */
  static normalizeBaseURL(url: string): string {
    const cleanUrl = url.trim();
    
    // Remove trailing slash if present
    return cleanUrl.endsWith('/') ? cleanUrl.slice(0, -1) : cleanUrl;
  }
}

/**
 * AI Configuration validation
 */
export class AIConfigValidator {
  /**
   * Validate complete AI configuration
   */
  static validateConfig(config: Partial<AIConfig>): { 
    isValid: boolean; 
    errors: string[]; 
    warnings: string[] 
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate API key
    if (!config.apiKey) {
      errors.push('API key is required');
    } else {
      const keyValidation = APIKeyValidator.validateAPIKey(config.apiKey);
      if (!keyValidation.isValid) {
        errors.push('Invalid API key format');
      } else if (keyValidation.type === 'generic') {
        // Only show warning if we're likely using OpenAI (based on base URL)
        const isLikelyOpenAI = config.baseUrl?.includes('openai.com') || 
                              config.baseUrl?.includes('api.openai.com');
        if (isLikelyOpenAI) {
          warnings.push('API key format not recognized as OpenAI - ensure compatibility');
        }
      }
    }

    // Validate base URL
    if (!config.baseUrl) {
      errors.push('Base URL is required');
    } else {
      if (!URLValidator.validateBaseURL(config.baseUrl)) {
        errors.push('Invalid base URL format');
      }
    }

    // Validate model
    if (!config.model) {
      errors.push('Model selection is required');
    } else if (typeof config.model !== 'string' || config.model.trim().length === 0) {
      errors.push('Invalid model selection');
    }

    // Validate image configuration if provided
    if (config.imageConfig) {
      // Validate image provider
      if (!config.imageConfig.provider) {
        errors.push('Image provider selection is required when image config is provided');
      } else if (!['openai', 'nano-gpt'].includes(config.imageConfig.provider)) {
        errors.push('Invalid image provider selection');
      }

      // Validate image API key if provided (otherwise uses main API key)
      if (config.imageConfig.apiKey) {
        const imageKeyValidation = APIKeyValidator.validateAPIKey(config.imageConfig.apiKey);
        if (!imageKeyValidation.isValid) {
          errors.push('Invalid image API key format');
        } else if (imageKeyValidation.type === 'generic' && config.imageConfig.provider === 'openai') {
          // Only show warning for OpenAI provider with non-OpenAI key format
          warnings.push('Image API key format not recognized as OpenAI - ensure compatibility');
        }
      }

      // Validate image base URL if provided (otherwise uses main base URL)
      if (config.imageConfig.baseUrl) {
        if (!URLValidator.validateBaseURL(config.imageConfig.baseUrl)) {
          errors.push('Invalid image base URL format');
        }
      }

      // Validate image model selection
      if (!config.imageConfig.model) {
        errors.push('Image model selection is required when image config is provided');
      } else if (typeof config.imageConfig.model !== 'string' || config.imageConfig.model.trim().length === 0) {
        errors.push('Invalid image model selection');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create a default AI configuration
   */
  static createDefaultConfig(): Partial<AIConfig> {
    return {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo',
      availableModels: []
    };
  }

  /**
   * Sanitize AI configuration input
   */
  static sanitizeConfig(config: Partial<AIConfig>): Partial<AIConfig> {
    const sanitized: Partial<AIConfig> = {};

    if (config.apiKey) {
      sanitized.apiKey = config.apiKey.trim();
    }

    if (config.baseUrl) {
      sanitized.baseUrl = URLValidator.normalizeBaseURL(config.baseUrl);
    }

    if (config.model) {
      sanitized.model = config.model.trim();
    }

    if (config.availableModels) {
      sanitized.availableModels = config.availableModels.filter(
        model => typeof model === 'string' && model.trim().length > 0
      );
    }

    // Preserve enableImageGeneration setting
    if (typeof config.enableImageGeneration === 'boolean') {
      sanitized.enableImageGeneration = config.enableImageGeneration;
    }

    // Sanitize image configuration if provided
    if (config.imageConfig && config.imageConfig.model && config.imageConfig.provider) {
      sanitized.imageConfig = {
        provider: config.imageConfig.provider,
        model: config.imageConfig.model.trim()
      };
      
      if (config.imageConfig.apiKey) {
        sanitized.imageConfig.apiKey = config.imageConfig.apiKey.trim();
      }
      
      if (config.imageConfig.baseUrl) {
        sanitized.imageConfig.baseUrl = URLValidator.normalizeBaseURL(config.imageConfig.baseUrl);
      }
      
      if (config.imageConfig.availableModels) {
        sanitized.imageConfig.availableModels = config.imageConfig.availableModels.filter(
          model => typeof model === 'string' && model.trim().length > 0
        );
      }
    }

    // Preserve sampler settings if provided
    if (config.samplerSettings) {
      sanitized.samplerSettings = config.samplerSettings;
    }

    return sanitized;
  }
}

/**
 * Model name validation
 */
export class ModelValidator {
  /**
   * Common OpenAI model names for validation
   */
  private static readonly KNOWN_OPENAI_TEXT_MODELS = [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k'
  ];

  private static readonly KNOWN_OPENAI_IMAGE_MODELS = [
    'dall-e-2',
    'dall-e-3'
  ];

  /**
   * Validate if a model name seems reasonable
   */
  static validateModelName(modelName: string): boolean {
    if (!modelName || typeof modelName !== 'string') return false;
    
    const cleanName = modelName.trim();
    
    // Basic validation: reasonable length and characters
    if (cleanName.length < 1 || cleanName.length > 100) return false;
    
    // Allow alphanumeric, hyphens, underscores, and dots
    const validPattern = /^[a-zA-Z0-9\-_.]+$/;
    return validPattern.test(cleanName);
  }

  /**
   * Check if model is a known OpenAI text model
   */
  static isKnownOpenAITextModel(modelName: string): boolean {
    return this.KNOWN_OPENAI_TEXT_MODELS.includes(modelName.trim());
  }

  /**
   * Check if model is a known OpenAI image model
   */
  static isKnownOpenAIImageModel(modelName: string): boolean {
    return this.KNOWN_OPENAI_IMAGE_MODELS.includes(modelName.trim());
  }

  /**
   * Check if model is a known OpenAI model (text or image)
   */
  static isKnownOpenAIModel(modelName: string): boolean {
    return this.isKnownOpenAITextModel(modelName) || this.isKnownOpenAIImageModel(modelName);
  }

  /**
   * Get suggestions for text model names based on input
   */
  static getTextModelSuggestions(input: string): string[] {
    if (!input) return this.KNOWN_OPENAI_TEXT_MODELS.slice(0, 5);
    
    const lowerInput = input.toLowerCase();
    return this.KNOWN_OPENAI_TEXT_MODELS.filter(model => 
      model.toLowerCase().includes(lowerInput)
    );
  }

  /**
   * Get suggestions for image model names based on input
   */
  static getImageModelSuggestions(input: string): string[] {
    if (!input) return this.KNOWN_OPENAI_IMAGE_MODELS;
    
    const lowerInput = input.toLowerCase();
    return this.KNOWN_OPENAI_IMAGE_MODELS.filter(model => 
      model.toLowerCase().includes(lowerInput)
    );
  }

  /**
   * Get suggestions for model names based on input (legacy method)
   */
  static getSuggestions(input: string): string[] {
    return [...this.getTextModelSuggestions(input), ...this.getImageModelSuggestions(input)];
  }
}