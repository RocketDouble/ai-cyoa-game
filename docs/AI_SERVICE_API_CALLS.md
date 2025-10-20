# AIService API Call Architecture

This document explains how the AIService class builds and executes API calls to various AI providers, including OpenAI, Anthropic, and other OpenAI-compatible services.

## Overview

The AIService acts as a unified interface for multiple AI providers, handling the complexities of different API formats, authentication methods, and response structures. It provides both streaming and non-streaming chat completion capabilities with robust error handling and retry logic.

## Core Components

### 1. API Provider Detection

The service automatically detects the AI provider based on the base URL:

```typescript
private static isAnthropicAPI(baseUrl: string): boolean {
  return baseUrl.includes('api.anthropic.com');
}
```

This detection drives different behaviors for:
- Request formatting
- Authentication headers
- Response parsing
- Message structure conversion

### 2. URL Transformation and Proxy Handling

The service handles CORS issues by routing requests through proxies for major providers:

```typescript
private static transformUrlForProxy(baseUrl: string, endpoint: string): string {
  // Anthropic API → /api/anthropic/v1/messages
  if (this.isAnthropicAPI(baseUrl)) {
    return `/api/anthropic${endpoint}`;
  }
  
  // OpenAI API → /api/openai/v1/chat/completions
  if (baseUrl.includes('api.openai.com')) {
    return `/api/openai${endpoint}`;
  }
  
  // Local/custom APIs → direct URL construction
  // Handles /v1 duplication and ensures proper path formatting
}
```

### 3. Authentication Header Construction

Different providers require different authentication methods:

```typescript
private static getHeaders(config: AIConfig, baseUrl: string): Record<string, string> {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'AI-CYOA-Game/1.0',
  };

  if (baseUrl.includes('api.anthropic.com')) {
    // Anthropic uses x-api-key header
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    // OpenAI and compatible APIs use Bearer token
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  return headers;
}
```

## Request Body Construction

### OpenAI Format
```typescript
{
  model: config.model,
  messages: [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'User message' },
    { role: 'assistant', content: 'AI response' }
  ],
  stream: true/false,
  temperature: 0.7,
  max_tokens: 1000,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0
}
```

### Anthropic Format
The service converts OpenAI-style messages to Anthropic's format:

```typescript
private static convertToAnthropicMessages(messages): {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  // Extracts system message separately
  // Filters out system messages from conversation
  // Returns formatted structure
}
```

Resulting in:
```typescript
{
  model: config.model,
  system: "System prompt", // Separate field
  messages: [
    { role: 'user', content: 'User message' },
    { role: 'assistant', content: 'AI response' }
  ],
  max_tokens: 1000,
  temperature: 0.7,
  stream: true/false
}
```

## API Call Methods

### 1. Streaming Chat Completion

```typescript
static async chatCompletionStream(
  config: AIConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  onChunk: (text: string) => void,
  options: {
    temperature?: number;
    maxTokens?: number;
    onThinkingChunk?: (text: string) => void;
  }
)
```

**Process Flow:**
1. Detect provider type (Anthropic vs OpenAI)
2. Transform URL for proxy if needed
3. Build appropriate headers
4. Construct request body in correct format
5. Make streaming fetch request
6. Process Server-Sent Events (SSE) stream
7. Parse chunks based on provider format
8. Handle thinking content extraction
9. Calculate Time to First Token (TTFS)
10. Estimate token usage if not provided

**Streaming Response Processing:**
- Reads response as a stream using ReadableStream
- Processes Server-Sent Events line by line
- Handles different chunk formats:
  - OpenAI: `data.choices[0].delta.content`
  - Anthropic: `data.delta.text`
- Extracts thinking content using ThinkingParser
- Tracks token usage from API or estimates it

### 2. Non-Streaming Chat Completion

```typescript
static async chatCompletion(
  config: AIConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }
)
```

**Process Flow:**
1. Similar setup to streaming version
2. Make single fetch request
3. Parse JSON response
4. Extract content based on provider format
5. Handle thinking content parsing
6. Return complete response with token usage

### 3. Retry Logic

```typescript
static async chatCompletionWithRetry(
  config: AIConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { maxRetries?: number; ... }
)
```

**Retry Strategy:**
- Maximum 3 retries by default
- Exponential backoff: 1s, 2s, 4s delays
- Only retries on retryable errors
- Skips retry for authentication and client errors

## Response Parsing

### OpenAI Response Format
```typescript
{
  choices: [{
    message: {
      content: "AI response text"
    }
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50
  }
}
```

### Anthropic Response Format
```typescript
{
  content: [{
    text: "AI response text"
  }],
  usage: {
    input_tokens: 100,
    output_tokens: 50
  }
}
```

### Unified Response Processing
The service normalizes both formats into a consistent internal structure:

```typescript
{
  response: string,           // Clean response text
  thinkingContent: string,    // Extracted thinking content
  ttfs?: number,             // Time to first token (streaming only)
  tokenUsage?: TokenUsage,   // Normalized token counts
  modelName: string          // Model identifier
}
```

## Error Handling

### Error Types
```typescript
export class AIServiceError extends Error {
  public readonly code: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'API_ERROR' | 'PARSE_ERROR' | 'TIMEOUT_ERROR';
  public readonly retryable: boolean;
  public readonly statusCode?: number;
}
```

### Error Classification
- **401/403**: Authentication errors (non-retryable)
- **404**: API endpoint errors (non-retryable)
- **429**: Rate limiting (retryable)
- **5xx**: Server errors (retryable)
- **Network errors**: Connection issues (retryable)
- **Parse errors**: Response format issues (non-retryable)

## Special Features

### 1. Thinking Content Processing
The service integrates with ThinkingParser to handle AI models that output reasoning in `<thinking>` tags:
- Extracts thinking content during streaming
- Provides separate callbacks for thinking vs display content
- Cleans final response of thinking tags

### 2. Token Usage Tracking
- Extracts token usage from API responses when available
- Falls back to TokenEstimator for APIs that don't provide usage
- Normalizes different token counting formats

### 3. Time to First Token (TTFS)
- Measures response latency for streaming requests
- Tracks time from request start to first content token
- Useful for performance monitoring

### 4. Connection Testing
```typescript
static async testConnection(config: AIConfig): Promise<{ success: boolean; error?: string }>
```
Validates API configuration with a minimal test request.

## Usage Examples

### Basic Chat Completion
```typescript
const result = await AIService.chatCompletion(config, [
  AIService.createSystemMessage("You are a helpful assistant"),
  AIService.createUserMessage("Hello!")
], {
  temperature: 0.7,
  maxTokens: 100
});
```

### Streaming with Thinking Support
```typescript
const result = await AIService.chatCompletionStream(
  config,
  messages,
  (chunk) => console.log('Display:', chunk),
  {
    onThinkingChunk: (thinking) => console.log('Thinking:', thinking),
    temperature: 0.8
  }
);
```

This architecture provides a robust, unified interface for multiple AI providers while handling the complexities of different API formats, authentication methods, and response structures.