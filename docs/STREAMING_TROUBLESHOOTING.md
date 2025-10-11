# Streaming Troubleshooting Guide

## Issue: Text appears all at once instead of streaming

### What was fixed:
The original implementation had `isLoading` set to `true` during streaming, which caused the StoryDisplay component to show the loading spinner instead of the streaming text.

### Solution Applied:
1. **GameManager changes:**
   - Set `isLoading = false` when streaming starts
   - Set `isStreaming = true` to indicate streaming is active
   - Removed `setIsLoading(false)` from the `finally` block in `handleChoiceSelect`

2. **StoryDisplay changes:**
   - Modified loading check: `if (isLoading && !isStreaming)` - only show spinner if NOT streaming
   - Modified no-story check: `if (!currentStory && !isStreaming)` - allow streaming even without currentStory
   - Hide scene description and images during streaming for cleaner UX
   - Use optional chaining for currentStory: `currentStory?.text`

### How to verify it's working:

1. **Open browser console** (F12)
2. **Start a new game** or **make a choice**
3. **Look for these console messages:**
   ```
   [Streaming] Starting stream request...
   [Streaming] Response received, status: 200
   [Streaming] Starting to read stream...
   [Streaming] Stream complete. Total chunks: X Total length: Y
   ```

4. **Visual indicators:**
   - Text should appear character-by-character
   - Blue blinking cursor should be visible at the end of streaming text
   - No loading spinner should appear during streaming
   - Choices should appear AFTER streaming completes

### Common Issues:

#### 1. API doesn't support streaming
**Symptom:** Console shows "Stream complete. Total chunks: 0"
**Solution:** Your API endpoint might not support SSE streaming. Check your API documentation.

#### 2. CORS issues
**Symptom:** Network error in console
**Solution:** Ensure your API server has proper CORS headers for streaming:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization
```

#### 3. Text still appears all at once
**Symptom:** Console shows chunks being received, but UI doesn't update
**Solution:** Check React DevTools to verify `streamingText` state is updating

#### 4. Streaming works but is very slow
**Symptom:** Long pauses between characters
**Solution:** This is likely network latency or slow AI generation. The streaming is working correctly.

### Debug Mode:

To see detailed streaming logs, open the browser console. The implementation includes:
- Request start logging
- Response status logging
- Stream reading progress
- Chunk count and total length on completion
- Error logging for malformed chunks

### Fallback to Non-Streaming:

If streaming doesn't work with your API, you can revert to non-streaming by:

1. In `GameManager.tsx`, replace:
   - `StoryService.generateInitialStoryStream` → `StoryService.generateInitialStory`
   - `StoryService.continueStoryStream` → `StoryService.continueStory`

2. Remove the `onChunk` callback parameter

3. Set `isLoading = true` instead of `isStreaming = true`
