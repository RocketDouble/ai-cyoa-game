# AI Thinking Feature

## Overview

The AI Thinking feature addresses the issue where thinking models (like Claude with thinking capabilities) wrap their responses in `<think>...</think>` tags, which can interfere with story parsing and display.

## Problem

When using thinking models, the AI response typically looks like this:

```
<think>
I need to consider the player's previous choices and create a compelling continuation.
The character should face a meaningful consequence from their last action.
I should maintain the dark fantasy tone established earlier.
</think>

STORY: The ancient door creaks open, revealing a chamber filled with ethereal light...
CHOICES:
1. Step into the light
2. Examine the door frame for traps
3. Call out to see if anyone responds
```

Without proper handling, the thinking content would interfere with story parsing, causing the parser to fail or include thinking content in the displayed story.

## Solution

The solution implements a comprehensive thinking content handling system:

### 1. ThinkingParser Utility (`src/utils/ThinkingParser.ts`)

- **`parseThinkingResponse()`**: Extracts thinking content from complete responses
- **`createStreamingProcessor()`**: Handles thinking content in streaming responses
- **`validateThinkingTags()`**: Validates proper thinking tag formatting
- **`cleanupMalformedTags()`**: Cleans up malformed thinking tags

### 2. ThinkingDisplay Component (`src/components/ThinkingDisplay.tsx`)

A collapsible UI component that:
- Shows thinking content in an expandable dropdown
- Displays character count and thinking indicator
- Uses a clean, non-intrusive design
- Provides context about what the thinking content represents
- **Auto-scrolls during streaming** to follow new thinking content
- Detects user scrolling and pauses auto-scroll when user scrolls up
- Shows "Follow" button to resume auto-scrolling when user has scrolled up
- Displays streaming indicator with animated cursor and "Thinking..." status

### 3. Service Layer Updates

**AIService** (`src/services/AIService.ts`):
- Updated streaming method to separate thinking and display content
- Added `onThinkingChunk` callback for streaming thinking content
- Handles thinking content in both streaming and non-streaming responses

**StoryService** (`src/services/StoryService.ts`):
- Updated all story generation methods to handle thinking content
- Passes thinking callbacks through to AIService
- Returns thinking content alongside story segments

**CustomStoryService** (`src/services/CustomStoryService.ts`):
- Similar updates for custom story mode
- Maintains thinking content through regeneration

### 4. UI Integration

**StoryDisplay** (`src/components/StoryDisplay.tsx`):
- Displays ThinkingDisplay component when thinking content is available
- Handles both streaming and completed thinking content
- Positioned above the main story content

**GameManager** (`src/components/GameManager.tsx`):
- Manages thinking content state
- Passes thinking callbacks to story services
- Updates UI state when thinking content is received

## Usage

The feature works automatically when using thinking models:

1. **Streaming Mode**: Thinking content appears in real-time as it's generated
2. **Non-Streaming Mode**: Thinking content is extracted and displayed after generation
3. **User Interaction**: Users can expand/collapse the thinking display to see AI reasoning

## Benefits

1. **Improved Parsing**: Story content is properly parsed without thinking interference
2. **Transparency**: Users can see the AI's reasoning process
3. **Educational**: Helps users understand how the AI approaches story generation
4. **Debugging**: Useful for troubleshooting AI behavior
5. **Seamless UX**: Thinking content doesn't clutter the main story display
6. **Real-time Following**: Auto-scrolling keeps users engaged with the AI's thinking process
7. **User Control**: Smart scroll detection respects user interaction while providing easy resume

## Technical Details

### Token Limits

Story generation methods use increased token limits to accommodate thinking content:
- **Story Generation**: 1024 tokens (increased from 800 to allow for longer thinking processes)
- **Choice Generation**: 400 tokens (appropriate for choice lists)
- **Image Descriptions**: 250-300 tokens (appropriate for scene descriptions)

### Streaming Processing

The streaming processor maintains state across chunks to properly handle thinking tags that span multiple chunks:

```typescript
const processor = ThinkingParser.createStreamingProcessor();
const result = processor.processChunk(chunk);
// result.displayChunk goes to main story
// result.thinkingChunk goes to thinking display
```

### Type Safety

The `StorySegment` interface now includes optional thinking content:

```typescript
interface StorySegment {
  id: string;
  text: string;
  imageUrl?: string;
  choices: Choice[];
  sceneDescription: string;
  thinkingContent?: string; // New field
}
```

### Error Handling

The system gracefully handles:
- Malformed thinking tags
- Incomplete thinking blocks in streaming
- Missing closing tags
- Nested thinking tags

## Auto-Scrolling Features

The thinking display includes intelligent auto-scrolling behavior:

### Smart Auto-Scroll
- Automatically scrolls to bottom when new thinking content arrives during streaming
- Only scrolls when the thinking panel is expanded and actively streaming
- Uses smooth scrolling animation for better UX

### User Scroll Detection
- Detects when user manually scrolls up to read previous thinking content
- Pauses auto-scrolling to respect user interaction
- Shows a "Follow" button to easily resume auto-scrolling
- Automatically resumes auto-scrolling after 2 seconds of no user scrolling

### Visual Indicators
- Animated cursor shows where new content is being added
- "Thinking..." indicator shows streaming status
- Character count updates in real-time
- Smooth transitions and hover effects

## Future Enhancements

Potential improvements could include:
- Syntax highlighting for thinking content
- Thinking content search/filtering
- Export thinking logs for analysis
- Thinking content statistics
- Custom thinking display themes
- Keyboard shortcuts for thinking panel control
- Thinking content bookmarking/annotations