# Time to First Token (TTFS) Feature

## Overview

The TTFS (Time to First Token) feature measures the time it takes from sending a prompt to the AI service until receiving the first token of the response. This metric is crucial for understanding the responsiveness of your AI model and can help with performance optimization.

## How It Works

1. **Measurement**: When a streaming AI request is made, the system records the timestamp when the request is sent and when the first content token is received.

2. **Storage**: The TTFS measurement (in milliseconds) is stored in the `StorySegment` object as the `ttfs` property.

3. **Display**: TTFS is displayed in the story history and current story segment with color-coded performance indicators.

## Performance Indicators

The TTFS display uses color coding to indicate performance:

- **Green (< 1s)**: Excellent performance
- **Blue (1-3s)**: Good performance  
- **Yellow (3-5s)**: Fair performance
- **Red (> 5s)**: Slow performance

## Where TTFS is Displayed

### Story History
When you expand the story history, each segment shows its TTFS measurement next to the segment number.

### Current Story
The current story segment displays its TTFS in the scene information area at the bottom of the story text.

## Technical Implementation

### Types
```typescript
export interface StorySegment {
  // ... other properties
  ttfs?: number; // Time to First Token in milliseconds
}
```

### AI Service
The `AIService.chatCompletionStream` method measures TTFS by:
1. Recording start time before sending the request
2. Recording first token time when the first content chunk is received
3. Calculating the difference and returning it with the response

### Story Services
Both `StoryService` and `CustomStoryService` pass through the TTFS data from the AI service to the story segments.

## Benefits

1. **Performance Monitoring**: Track how responsive your AI model is
2. **Model Comparison**: Compare TTFS between different models or configurations
3. **Optimization**: Identify when your AI service might be experiencing latency issues
4. **User Experience**: Understand the actual response times users experience

## Notes

- TTFS is only measured for streaming requests
- Non-streaming requests do not include TTFS measurements
- TTFS includes network latency and AI model processing time
- The measurement is client-side and reflects the user's actual experience