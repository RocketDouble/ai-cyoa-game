# TTFS and Token Usage Metrics

## Overview

This feature provides comprehensive metrics for AI interactions:

1. **TTFS (Time to First Token)**: Measures the time from sending a prompt until receiving the first token of the response
2. **Token Usage**: Tracks input and output tokens for each AI request

These metrics are crucial for understanding AI model performance, cost optimization, and user experience.

## How It Works

### TTFS Measurement
1. **Timing**: When a streaming AI request is made, the system records timestamps when the request is sent and when the first content token is received
2. **Storage**: TTFS measurement (in milliseconds) is stored in the `StorySegment` object as the `ttfs` property
3. **Display**: TTFS is shown with color-coded performance indicators

### Token Usage Tracking
1. **Collection**: Token usage data is extracted from AI API responses (both streaming and non-streaming)
2. **Storage**: Input and output token counts are stored in the `StorySegment` object as the `tokenUsage` property
3. **Display**: Token usage is shown in the format "5673 → 200" (input → output tokens)

## Performance Indicators

### TTFS Color Coding
- **Green (< 1s)**: Excellent performance
- **Blue (1-3s)**: Good performance  
- **Yellow (3-5s)**: Fair performance
- **Red (> 5s)**: Slow performance

### Token Usage Color Coding
- **Green (< 100 tokens)**: Light usage
- **Blue (100-500 tokens)**: Moderate usage
- **Yellow (500-1000 tokens)**: Heavy usage
- **Purple (> 1000 tokens)**: Very heavy usage

## Where Metrics are Displayed

### Story History
When you expand the story history, each segment shows:
- TTFS measurement next to the segment number
- Token usage in the format "Tokens: 5673 → 200"

### Current Story
The current story segment displays both metrics in the scene information area at the bottom of the story text.

## Technical Implementation

### Types
```typescript
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StorySegment {
  // ... other properties
  ttfs?: number; // Time to First Token in milliseconds
  tokenUsage?: TokenUsage; // Token usage for this segment
}
```

### AI Service
The `AIService` methods now return comprehensive metrics:
- **TTFS Measurement**: Records timing from request start to first token
- **Token Usage Extraction**: Parses token usage from API responses (OpenAI and Anthropic formats)
- **Return Format**: `{ response: string; thinkingContent: string; ttfs?: number; tokenUsage?: TokenUsage }`

### Story Services
Both `StoryService` and `CustomStoryService` pass through all metrics from the AI service to the story segments.

## Benefits

### Performance Monitoring
- Track AI model responsiveness with TTFS measurements
- Monitor token consumption patterns
- Identify performance bottlenecks

### Cost Optimization
- Track token usage to understand API costs
- Compare efficiency between different models
- Optimize prompts based on token consumption

### User Experience
- Understand actual response times users experience
- Monitor for performance degradation
- Make informed decisions about model selection

## Notes

### TTFS Limitations
- TTFS is only measured for streaming requests
- Non-streaming requests do not include TTFS measurements
- TTFS includes network latency and AI model processing time
- The measurement is client-side and reflects the user's actual experience

### Token Usage
- Token usage is tracked for both streaming and non-streaming requests
- Supports OpenAI and Anthropic API response formats
- Token counts are extracted directly from API responses when available
- Fallback handling for APIs that don't provide usage data