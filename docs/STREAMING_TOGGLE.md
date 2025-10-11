# Streaming Toggle Feature

## Overview
Added a user-configurable toggle to enable/disable text streaming in the Sampler Settings.

## Changes Made

### 1. Type Definition (`src/types/index.ts`)
```typescript
export interface SamplerSettings {
  temperature: number;
  minP: number;
  repetitionPenalty: number;
  enableStreaming?: boolean; // NEW - defaults to true
}
```

### 2. Sampler Settings UI (`src/components/SamplerSettings.tsx`)
- Added toggle switch for "Enable Text Streaming"
- Positioned below other sampler settings with a border separator
- Includes helpful description: "Show text as it's generated (like SillyTavern)"
- Default value: `true`
- Styled as an iOS-style toggle switch

### 3. Game Manager Logic (`src/components/GameManager.tsx`)
- Checks `samplerSettings.enableStreaming ?? true` before generating story
- **When enabled**: Uses streaming methods, sets `isStreaming = true`, `isLoading = false`
- **When disabled**: Uses non-streaming methods, sets `isLoading = true`, `isStreaming = false`
- Applied to both `startNewGame()` and `handleChoiceSelect()`

## User Experience

### Accessing the Toggle:
1. Click the "Sampler" button (gear icon) in the game interface
2. Scroll to the bottom of the modal
3. Toggle "Enable Text Streaming" on or off
4. Click "Save Changes"

### Behavior:
- **Streaming ON** (default):
  - Text appears character-by-character
  - Blinking cursor indicator
  - No loading spinner
  - More engaging experience

- **Streaming OFF**:
  - Loading spinner appears
  - Text appears all at once when complete
  - Traditional loading experience
  - Useful if streaming causes issues or user prefers instant text

### Persistence:
- Setting is saved with other sampler settings
- Persists across sessions
- Stored in localStorage via AIConfigStorage

## Why This Feature?

Some users might prefer to:
1. **See only the final parsed text** without the raw AI response
2. **Avoid potential formatting issues** during streaming
3. **Have a more traditional loading experience**
4. **Work around API compatibility issues** if streaming doesn't work properly

## Technical Notes

### Default Behavior:
- If `enableStreaming` is undefined, defaults to `true`
- Uses `??` operator: `samplerSettings.enableStreaming ?? true`
- Backward compatible with existing saved settings

### Method Selection:
```typescript
const useStreaming = samplerSettings.enableStreaming ?? true;

const story = useStreaming
  ? await StoryService.generateInitialStoryStream(config, onChunk, settings)
  : await StoryService.generateInitialStory(config, settings);
```

### State Management:
- Both streaming and non-streaming paths properly manage state
- Ensures `isLoading` and `isStreaming` are mutually exclusive
- Cleans up state on error or completion

## Testing

To test the toggle:
1. Start a new game with streaming enabled (default)
2. Observe character-by-character text appearance
3. Open Sampler Settings and disable streaming
4. Make a choice
5. Observe loading spinner and instant text appearance
6. Re-enable streaming and verify it works again
