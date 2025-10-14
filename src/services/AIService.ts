import type { AIConfig } from '../types';
import { ThinkingParser } from '../utils/ThinkingParser';
import { TokenEstimator } from '../utils/TokenEstimator';

/**
 * Error types for AI service operations
 */
export class AIServiceError extends Error {
  public readonly code: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'API_ERROR' | 'PARSE_ERROR' | 'TIMEOUT_ERROR';
  public readonly retryable: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    code: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'API_ERROR' | 'PARSE_ERROR' | 'TIMEOUT_ERROR',
    retryable: boolean = true,
    statusCode?: number
  ) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

/**
 * Base AI service wrapper for OpenAI-compatible API calls
 * Provides HTTP client functionality with proper error management and retry logic
 */
export class AIService {

  private static readonly MAX_RETRIES = 3;

  /**
   * Check if the API is Anthropic
   */
  private static isAnthropicAPI(baseUrl: string): boolean {
    return baseUrl.includes('api.anthropic.com');
  }

  /**
   * Transform API URL to use proxy if needed (to avoid CORS issues)
   */
  private static transformUrlForProxy(baseUrl: string, endpoint: string): string {
    // Use proxy for Anthropic API to avoid CORS issues
    if (this.isAnthropicAPI(baseUrl)) {
      return `/api/anthropic${endpoint}`;
    }
    // Use proxy for OpenAI API to avoid CORS issues
    if (baseUrl.includes('api.openai.com')) {
      return `/api/openai${endpoint}`;
    }
    
    // For other APIs (like local LM Studio), construct URL properly
    // Remove trailing slash from baseUrl
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Handle the case where baseUrl already includes /v1 and endpoint starts with /v1
    if (cleanBaseUrl.endsWith('/v1') && endpoint.startsWith('/v1/')) {
      // Remove /v1 from the beginning of endpoint to avoid duplication
      const endpointWithoutV1 = endpoint.substring(3); // Remove "/v1" (3 chars)
      return `${cleanBaseUrl}${endpointWithoutV1}`;
    }
    
    // Normal case: ensure endpoint starts with /
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${cleanBaseUrl}${cleanEndpoint}`;
  }

  /**
   * Convert OpenAI-style messages to Anthropic format
   */
  private static convertToAnthropicMessages(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): {
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    return {
      system: systemMessage?.content,
      messages: conversationMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    };
  }

  /**
   * Get headers for API request, handling different API formats
   */
  private static getHeaders(config: AIConfig, baseUrl: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AI-CYOA-Game/1.0',
    };

    // Anthropic uses x-api-key header
    if (baseUrl.includes('api.anthropic.com')) {
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      // OpenAI and compatible APIs use Bearer token
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    return headers;
  }

  /**
   * Make a streaming chat completion request to the AI service
   */
  static async chatCompletionStream(
    config: AIConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onChunk: (text: string) => void,
    options: {
      temperature?: number;
      maxTokens?: number;
      onThinkingChunk?: (text: string) => void;
    } = {}
  ): Promise<{ response: string; thinkingContent: string; ttfs?: number; tokenUsage?: import('../types').TokenUsage; modelName: string }> {
    const isAnthropic = this.isAnthropicAPI(config.baseUrl);
    const endpoint = isAnthropic ? '/v1/messages' : '/v1/chat/completions';
    const url = this.transformUrlForProxy(config.baseUrl, endpoint);
    const headers = this.getHeaders(config, config.baseUrl);
    headers['Accept'] = 'text/event-stream';
    
    let requestBody: Record<string, unknown>;
    
    if (isAnthropic) {
      const { system, messages: anthropicMessages } = this.convertToAnthropicMessages(messages);
      requestBody = {
        model: config.model,
        messages: anthropicMessages,
        max_tokens: options.maxTokens ?? 1000,
        temperature: options.temperature ?? 0.7,
        stream: true,
      };
      if (system) {
        requestBody.system = system;
      }
    } else {
      requestBody = {
        model: config.model,
        messages,
        stream: true,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      };
    }

    try {
      const startTime = performance.now();
      let firstTokenTime: number | undefined;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      if (!response.body) {
        throw new AIServiceError('No response body received', 'API_ERROR');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';
      let tokenUsage: import('../types').TokenUsage | undefined;

      // Initialize thinking processor for handling thinking tags in streaming
      const thinkingProcessor = ThinkingParser.createStreamingProcessor();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
          
          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);
              const data = JSON.parse(jsonStr);
              
              let rawChunk = '';
              
              // Handle Anthropic format
              if (isAnthropic) {
                if (data.type === 'content_block_delta' && data.delta?.text) {
                  rawChunk = data.delta.text;
                }
                // Extract usage data from Anthropic message_delta or message_stop events
                if ((data.type === 'message_delta' || data.type === 'message_stop') && data.usage) {
                  tokenUsage = {
                    inputTokens: data.usage.input_tokens || 0,
                    outputTokens: data.usage.output_tokens || 0
                  };
                }
              } else {
                // Handle OpenAI format
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  rawChunk = content;
                }
                // Extract usage data from OpenAI streaming response
                // This can appear in the final chunk or in a separate usage chunk
                if (data.usage) {
                  tokenUsage = {
                    inputTokens: data.usage.prompt_tokens || 0,
                    outputTokens: data.usage.completion_tokens || 0
                  };
                }
                // Some OpenAI-compatible APIs send usage in the choice object
                if (data.choices?.[0]?.usage) {
                  const choiceUsage = data.choices[0].usage;
                  tokenUsage = {
                    inputTokens: choiceUsage.prompt_tokens || 0,
                    outputTokens: choiceUsage.completion_tokens || 0
                  };
                }
              }

              if (rawChunk) {
                // Record TTFS on first content token
                if (firstTokenTime === undefined) {
                  firstTokenTime = performance.now();
                }

                fullText += rawChunk;

                // Process chunk for thinking content
                const processed = thinkingProcessor.processChunk(rawChunk);
                
                // Send thinking chunk to thinking callback if provided
                if (processed.thinkingChunk && options.onThinkingChunk) {
                  options.onThinkingChunk(processed.thinkingChunk);
                }
                
                // Send display chunk to main callback
                if (processed.displayChunk) {
                  onChunk(processed.displayChunk);
                }
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      }

      // Get final thinking content
      const { thinkingContent } = thinkingProcessor.getState();

      // Calculate TTFS
      const ttfs = firstTokenTime !== undefined ? firstTokenTime - startTime : undefined;

      // If no token usage was provided by the API, estimate it
      // Use the cleaned response (without thinking content) for accurate token estimation
      if (!tokenUsage && fullText) {
        const { cleanedResponse } = ThinkingParser.parseThinkingResponse(fullText);
        tokenUsage = TokenEstimator.createEstimatedUsage(messages, cleanedResponse);
      }

      return { 
        response: fullText, 
        thinkingContent,
        ttfs,
        tokenUsage,
        modelName: config.model
      };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AIServiceError(
          'Network error: Unable to connect to AI service',
          'NETWORK_ERROR'
        );
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AIServiceError(
        `Unexpected error: ${errorMessage}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Make a chat completion request to the AI service
   */
  static async chatCompletion(
    config: AIConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {}
  ): Promise<{ response: string; tokenUsage?: import('../types').TokenUsage; modelName: string }> {
    const isAnthropic = this.isAnthropicAPI(config.baseUrl);
    const endpoint = isAnthropic ? '/v1/messages' : '/v1/chat/completions';
    const url = this.transformUrlForProxy(config.baseUrl, endpoint);
    const headers = this.getHeaders(config, config.baseUrl);
    headers['Accept'] = 'application/json';
    
    let requestBody: Record<string, unknown>;
    
    if (isAnthropic) {
      const { system, messages: anthropicMessages } = this.convertToAnthropicMessages(messages);
      requestBody = {
        model: config.model,
        messages: anthropicMessages,
        max_tokens: options.maxTokens ?? 1000,
        temperature: options.temperature ?? 0.7,
      };
      if (system) {
        requestBody.system = system;
      }
    } else {
      requestBody = {
        model: config.model,
        messages,
        stream: options.stream ?? false,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        cache_control: {
          enabled: false,
          ttl: "5m"
        }
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json();
      
      // Check for error responses before parsing
      if (data && typeof data === 'object' && 'error' in data) {
        const errorObj = (data as { error: unknown }).error;
        let errorMessage = 'API returned an error';
        
        if (errorObj && typeof errorObj === 'object') {
          // Try to extract error message from various possible fields
          const errorFields = ['message', 'detail', 'description', 'error'];
          for (const field of errorFields) {
            if (field in errorObj && typeof (errorObj as Record<string, unknown>)[field] === 'string') {
              errorMessage = (errorObj as Record<string, unknown>)[field] as string;
              break;
            }
          }
          
          // If no message found, try to stringify the error object
          if (errorMessage === 'API returned an error') {
            try {
              errorMessage = `API error: ${JSON.stringify(errorObj)}`;
            } catch {
              errorMessage = 'API returned an unreadable error';
            }
          }
        } else if (typeof errorObj === 'string') {
          errorMessage = errorObj;
        }
        
        throw new AIServiceError(errorMessage, 'API_ERROR');
      }
      
      const { response: rawResult, tokenUsage: apiTokenUsage } = this.parseChatCompletionResponse(data, isAnthropic);
      
      // Parse thinking content from non-streaming response
      const { cleanedResponse } = ThinkingParser.parseThinkingResponse(rawResult);
      
      // If no token usage was provided by the API, estimate it
      const tokenUsage = apiTokenUsage || TokenEstimator.createEstimatedUsage(messages, cleanedResponse);
      
      return { response: cleanedResponse, tokenUsage, modelName: config.model };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AIServiceError(
          'Network error: Unable to connect to AI service',
          'NETWORK_ERROR'
        );
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIServiceError(
          'Request timeout: AI service took too long to respond',
          'TIMEOUT_ERROR'
        );
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AIServiceError(
        `Unexpected error: ${errorMessage}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Make a chat completion request with manual retry functionality
   */
  static async chatCompletionWithRetry(
    config: AIConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<{ response: string; tokenUsage?: import('../types').TokenUsage; modelName: string }> {
    const maxRetries = options.maxRetries ?? this.MAX_RETRIES;
    let lastError: AIServiceError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.chatCompletion(config, messages, options);
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

        // Wait before retrying (exponential backoff)
        await this.delay(Math.pow(2, attempt - 1) * 1000);
      }
    }

    throw lastError!;
  }

  /**
   * Test API connectivity with a simple request
   */
  static async testConnection(config: AIConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const testMessages = [
        { role: 'user' as const, content: 'Hello' }
      ];
      
      await this.chatCompletion(config, testMessages, { maxTokens: 10 });
      return { success: true };
    } catch (error) {
      const message = error instanceof AIServiceError 
        ? error.message 
        : 'Unknown connection error';
      return { success: false, error: message };
    }
  }



  /**
   * Handle error responses from the API
   */
  private static async handleErrorResponse(response: Response): Promise<AIServiceError> {
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

    return new AIServiceError(errorMessage, errorCode, retryable, response.status);
  }

  /**
   * Parse the chat completion response from the API
   */
  private static parseChatCompletionResponse(data: unknown, isAnthropic: boolean = false): { response: string; tokenUsage?: import('../types').TokenUsage } {
    try {
      // Handle Anthropic format
      if (isAnthropic) {
        if (!data || typeof data !== 'object' || !('content' in data) || !Array.isArray((data as { content: unknown }).content)) {
          throw new Error('Invalid Anthropic response format: expected content array');
        }

        const anthropicData = data as { content: unknown[]; usage?: { input_tokens?: number; output_tokens?: number } };
        const contentBlocks = anthropicData.content;
        
        if (contentBlocks.length === 0) {
          throw new Error('No content blocks returned from Anthropic');
        }

        // Extract text from all content blocks
        let fullText = '';
        for (const block of contentBlocks) {
          if (block && typeof block === 'object' && 'text' in block && typeof (block as { text: unknown }).text === 'string') {
            fullText += (block as { text: string }).text;
          }
        }

        if (!fullText) {
          throw new Error('No text content found in Anthropic response');
        }

        // Extract token usage
        const tokenUsage = anthropicData.usage ? {
          inputTokens: anthropicData.usage.input_tokens || 0,
          outputTokens: anthropicData.usage.output_tokens || 0
        } : undefined;

        return { response: fullText.trim(), tokenUsage };
      }

      // Handle OpenAI format
      if (!data || typeof data !== 'object' || !('choices' in data) || !Array.isArray((data as { choices: unknown }).choices)) {
        // Log the actual response format for debugging (only in development)
        if (process.env.NODE_ENV === 'development') {
          console.error('Unexpected response format:', data);
          console.error('Response type:', typeof data);
          console.error('Response keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A');
        }
        
        // Check if this might be a direct text response (some thinking models might return this)
        if (data && typeof data === 'object' && 'content' in data && typeof (data as { content: unknown }).content === 'string') {
          return { response: (data as { content: string }).content.trim() };
        }
        
        // Check if the response is just a string (some APIs might return this)
        if (typeof data === 'string') {
          return { response: data.trim() };
        }
        
        // Check if it's a malformed OpenAI response with different structure
        if (data && typeof data === 'object') {
          // Try to find any text content in the response
          const possibleContent = this.extractTextFromUnknownFormat(data);
          if (possibleContent) {
            return { response: possibleContent.trim() };
          }
        }
        
        throw new Error(`Invalid response format: expected choices array. Got: ${typeof data}`);
      }

      const openAIData = data as { choices: unknown[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      const responseData = openAIData.choices;
      
      if (responseData.length === 0) {
        throw new Error('No choices returned from AI service');
      }

      const firstChoice = responseData[0];
      if (!firstChoice || typeof firstChoice !== 'object' || !('message' in firstChoice)) {
        throw new Error('Invalid choice format: expected message object');
      }

      const message = (firstChoice as { message: unknown }).message;
      if (!message || typeof message !== 'object' || !('content' in message)) {
        throw new Error('Invalid message format: expected content string');
      }

      const content = (message as { content: unknown }).content;
      if (typeof content !== 'string') {
        throw new Error('Invalid content format: expected string');
      }

      // Extract token usage
      const tokenUsage = openAIData.usage ? {
        inputTokens: openAIData.usage.prompt_tokens || 0,
        outputTokens: openAIData.usage.completion_tokens || 0
      } : undefined;

      return { response: content.trim(), tokenUsage };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
      throw new AIServiceError(
        `Failed to parse AI response: ${errorMessage}`,
        'PARSE_ERROR',
        false
      );
    }
  }

  /**
   * Try to extract text content from unknown response formats
   */
  private static extractTextFromUnknownFormat(data: unknown): string | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const obj = data as Record<string, unknown>;

    // Common text fields to check
    const textFields = ['text', 'content', 'message', 'response', 'output', 'result'];
    
    for (const field of textFields) {
      if (field in obj && typeof obj[field] === 'string') {
        return obj[field] as string;
      }
    }

    // Check nested structures
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        const nestedText = this.extractTextFromUnknownFormat(value);
        if (nestedText) {
          return nestedText;
        }
      }
    }

    return null;
  }

  /**
   * Utility function for delays in retry logic
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a system message for AI prompts
   */
  static createSystemMessage(content: string): { role: 'system'; content: string } {
    return { role: 'system', content };
  }

  /**
   * Create a user message for AI prompts
   */
  static createUserMessage(content: string): { role: 'user'; content: string } {
    return { role: 'user', content };
  }

  /**
   * Create an assistant message for AI prompts
   */
  static createAssistantMessage(content: string): { role: 'assistant'; content: string } {
    return { role: 'assistant', content };
  }
}