import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelService, ModelServiceError } from '../ModelService';
import type { AIConfig, ModelInfo } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ModelService', () => {
  const mockConfig: AIConfig = {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.test.com/v1',
    model: 'gpt-3.5-turbo'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAvailableModels', () => {
    it('should fetch and parse models successfully', async () => {
      const mockResponse = {
        data: [
          { id: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo model' },
          { id: 'gpt-4', description: 'GPT-4 model' },
          { id: 'claude-3-sonnet' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await ModelService.fetchAvailableModels(mockConfig);

      expect(result).toEqual([
        { id: 'claude-3-sonnet', name: 'claude-3-sonnet', description: undefined },
        { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo model' },
        { id: 'gpt-4', name: 'gpt-4', description: 'GPT-4 model' }
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should throw error for missing API key', async () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };

      const error = await ModelService.fetchAvailableModels(invalidConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('API_ERROR');
      expect(error.retryable).toBe(false);
    });

    it('should throw error for missing base URL', async () => {
      const invalidConfig = { ...mockConfig, baseUrl: '' };

      const error = await ModelService.fetchAvailableModels(invalidConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const error = await ModelService.fetchAvailableModels(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      const error = await ModelService.fetchAvailableModels(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should handle 401 authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } })
      });

      const error = await ModelService.fetchAvailableModels(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.retryable).toBe(false);
    });

    it('should handle 404 not found errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({})
      });

      const error = await ModelService.fetchAvailableModels(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('API_ERROR');
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('API endpoint not found');
    });

    it('should handle 429 rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({})
      });

      const error = await ModelService.fetchAvailableModels(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('API_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should handle 500 server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({})
      });

      const error = await ModelService.fetchAvailableModels(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('API_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should handle invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'format' })
      });

      const error = await ModelService.fetchAvailableModels(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('PARSE_ERROR');
      expect(error.retryable).toBe(false);
    });

    it('should filter out invalid model entries', async () => {
      const mockResponse = {
        data: [
          { id: 'valid-model', description: 'Valid model' },
          { invalid: 'entry' }, // Missing id
          null, // Null entry
          { id: 123 }, // Non-string id
          { id: 'another-valid-model' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await ModelService.fetchAvailableModels(mockConfig);

      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toEqual(['another-valid-model', 'valid-model']);
    });

    it('should sort models alphabetically by name', async () => {
      const mockResponse = {
        data: [
          { id: 'zebra-model' },
          { id: 'alpha-model' },
          { id: 'beta-model' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await ModelService.fetchAvailableModels(mockConfig);

      expect(result.map(m => m.id)).toEqual(['alpha-model', 'beta-model', 'zebra-model']);
    });

    it('should handle malformed JSON in error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const error = await ModelService.fetchAvailableModels(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('API_ERROR');
    });
  });

  describe('validateModelAccess', () => {
    it('should return true for available model', async () => {
      const mockResponse = {
        data: [
          { id: 'gpt-3.5-turbo' },
          { id: 'gpt-4' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await ModelService.validateModelAccess(mockConfig, 'gpt-4');
      expect(result).toBe(true);
    });

    it('should return false for unavailable model', async () => {
      const mockResponse = {
        data: [
          { id: 'gpt-3.5-turbo' },
          { id: 'gpt-4' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await ModelService.validateModelAccess(mockConfig, 'claude-3');
      expect(result).toBe(false);
    });

    it('should return false when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ModelService.validateModelAccess(mockConfig, 'gpt-4');
      expect(result).toBe(false);
    });
  });

  describe('getModelInfo', () => {
    it('should return model info for existing model', async () => {
      const mockResponse = {
        data: [
          { id: 'gpt-3.5-turbo', description: 'GPT-3.5 Turbo' },
          { id: 'gpt-4', description: 'GPT-4' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await ModelService.getModelInfo(mockConfig, 'gpt-4');
      expect(result).toEqual({
        id: 'gpt-4',
        name: 'gpt-4',
        description: 'GPT-4'
      });
    });

    it('should return null for non-existing model', async () => {
      const mockResponse = {
        data: [
          { id: 'gpt-3.5-turbo' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await ModelService.getModelInfo(mockConfig, 'non-existing');
      expect(result).toBeNull();
    });

    it('should return null when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ModelService.getModelInfo(mockConfig, 'gpt-4');
      expect(result).toBeNull();
    });
  });

  describe('testConnection', () => {
    it('should return success for valid connection', async () => {
      const mockResponse = {
        data: [{ id: 'gpt-3.5-turbo' }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await ModelService.testConnection(mockConfig);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for failed connection', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      const result = await ModelService.testConnection(mockConfig);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error message for ModelServiceError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({})
      });

      const result = await ModelService.testConnection(mockConfig);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key or unauthorized access');
    });
  });

  describe('filterTextModels', () => {
    const mockModels: ModelInfo[] = [
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'dall-e-3', name: 'DALL-E 3' },
      { id: 'whisper-1', name: 'Whisper' },
      { id: 'text-embedding-ada-002', name: 'Text Embedding' },
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
      { id: 'llama-2-7b-chat', name: 'Llama 2 Chat' },
      { id: 'mistral-7b-instruct', name: 'Mistral Instruct' },
      { id: 'gemini-pro', name: 'Gemini Pro' },
      { id: 'text-moderation-latest', name: 'Moderation' },
      { id: 'tts-1', name: 'Text to Speech' },
      { id: 'unknown-model', name: 'Unknown Model' }
    ];

    it('should include known text generation models', () => {
      const result = ModelService.filterTextModels(mockModels);
      
      const includedIds = result.map(m => m.id);
      expect(includedIds).toContain('gpt-3.5-turbo');
      expect(includedIds).toContain('gpt-4');
      expect(includedIds).toContain('claude-3-sonnet');
      expect(includedIds).toContain('llama-2-7b-chat');
      expect(includedIds).toContain('mistral-7b-instruct');
      expect(includedIds).toContain('gemini-pro');
    });

    it('should exclude known non-text models', () => {
      const result = ModelService.filterTextModels(mockModels);
      
      const includedIds = result.map(m => m.id);
      expect(includedIds).not.toContain('dall-e-3');
      expect(includedIds).not.toContain('whisper-1');
      expect(includedIds).not.toContain('text-embedding-ada-002');
      expect(includedIds).not.toContain('text-moderation-latest');
      expect(includedIds).not.toContain('tts-1');
    });

    it('should include unknown models by default', () => {
      const result = ModelService.filterTextModels(mockModels);
      
      const includedIds = result.map(m => m.id);
      expect(includedIds).toContain('unknown-model');
    });

    it('should handle empty model list', () => {
      const result = ModelService.filterTextModels([]);
      expect(result).toEqual([]);
    });

    it('should be case insensitive for pattern matching', () => {
      const caseTestModels: ModelInfo[] = [
        { id: 'GPT-4', name: 'GPT-4 Uppercase' },
        { id: 'DALL-E-3', name: 'DALL-E Uppercase' },
        { id: 'Text-Generation-Model', name: 'Text Model' }
      ];

      const result = ModelService.filterTextModels(caseTestModels);
      
      const includedIds = result.map(m => m.id);
      expect(includedIds).toContain('GPT-4');
      expect(includedIds).toContain('Text-Generation-Model');
      expect(includedIds).not.toContain('DALL-E-3');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle unexpected error types', async () => {
      mockFetch.mockRejectedValueOnce('String error');

      const error = await ModelService.fetchAvailableModels(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('API_ERROR');
      expect(error.message).toContain('Unexpected error');
    });

    it('should handle response parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('JSON parse error'))
      });

      const error = await ModelService.fetchAvailableModels(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(ModelServiceError);
      expect(error.code).toBe('API_ERROR');
    });
  });
});