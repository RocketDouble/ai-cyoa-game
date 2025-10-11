import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService, AIServiceError } from '../AIService';
import type { AIConfig } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AIService', () => {
  const mockConfig: AIConfig = {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.test.com/v1',
    model: 'gpt-3.5-turbo'
  };

  const mockMessages = [
    { role: 'user' as const, content: 'Hello' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('chatCompletion', () => {
    it('should successfully make a chat completion request', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello! How can I help you today?'
            }
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await AIService.chatCompletion(mockConfig, mockMessages);

      expect(result).toBe('Hello! How can I help you today?');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: mockMessages,
            temperature: 0.7,
            max_tokens: 1000,
            stream: false
          })
        })
      );
    });

    it('should handle custom options', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response' } }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await AIService.chatCompletion(mockConfig, mockMessages, {
        temperature: 0.9,
        maxTokens: 500,
        stream: true
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: mockMessages,
            temperature: 0.9,
            max_tokens: 500,
            stream: true
          })
        })
      );
    });

    it('should throw AIServiceError for network errors', async () => {
      const networkError = new TypeError('fetch failed');
      mockFetch.mockRejectedValueOnce(networkError);

      const error = await AIService.chatCompletion(mockConfig, mockMessages)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should throw AIServiceError for timeout', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      const error = await AIService.chatCompletion(mockConfig, mockMessages)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should handle 401 authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } })
      });

      const error = await AIService.chatCompletion(mockConfig, mockMessages)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBe(401);
    });

    it('should handle 429 rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({ error: { message: 'Rate limit exceeded' } })
      });

      const error = await AIService.chatCompletion(mockConfig, mockMessages)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('API_ERROR');
      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(429);
    });

    it('should handle 500 server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({})
      });

      const error = await AIService.chatCompletion(mockConfig, mockMessages)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('API_ERROR');
      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(500);
    });

    it('should throw PARSE_ERROR for invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      });

      const error = await AIService.chatCompletion(mockConfig, mockMessages)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('PARSE_ERROR');
      expect(error.retryable).toBe(false);
    });

    it('should throw PARSE_ERROR for empty choices array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ choices: [] })
      });

      const error = await AIService.chatCompletion(mockConfig, mockMessages)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('PARSE_ERROR');
    });

    it('should trim whitespace from response content', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '  \n  Hello with whitespace  \n  '
            }
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await AIService.chatCompletion(mockConfig, mockMessages);
      expect(result).toBe('Hello with whitespace');
    });
  });

  describe('chatCompletionWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Success' } }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await AIService.chatCompletionWithRetry(mockConfig, mockMessages);
      expect(result).toBe('Success');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on non-retryable errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } })
      });

      const error = await AIService.chatCompletionWithRetry(mockConfig, mockMessages)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('AUTH_ERROR');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('testConnection', () => {
    it('should return success for valid connection', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hello' } }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await AIService.testConnection(mockConfig);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for failed connection', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      const result = await AIService.testConnection(mockConfig);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error message for AIServiceError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } })
      });

      const result = await AIService.testConnection(mockConfig);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key or unauthorized access');
    });
  });

  describe('message creation helpers', () => {
    it('should create system message', () => {
      const message = AIService.createSystemMessage('You are a helpful assistant');
      expect(message).toEqual({
        role: 'system',
        content: 'You are a helpful assistant'
      });
    });

    it('should create user message', () => {
      const message = AIService.createUserMessage('Hello');
      expect(message).toEqual({
        role: 'user',
        content: 'Hello'
      });
    });

    it('should create assistant message', () => {
      const message = AIService.createAssistantMessage('Hi there!');
      expect(message).toEqual({
        role: 'assistant',
        content: 'Hi there!'
      });
    });
  });

  describe('error handling edge cases', () => {
    it('should handle malformed JSON in error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const error = await AIService.chatCompletion(mockConfig, mockMessages)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('API_ERROR');
    });

    it('should handle unexpected error types', async () => {
      mockFetch.mockRejectedValueOnce('String error');

      const error = await AIService.chatCompletion(mockConfig, mockMessages)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('API_ERROR');
      expect(error.message).toContain('Unexpected error');
    });
  });
});