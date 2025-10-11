# Image Generation Toggle Feature

## Overview
Added a toggle feature to enable/disable image generation in the game. When disabled, the game will run without generating or displaying any images, resulting in faster story generation and reduced token usage.

## Changes Made

### 1. Type Definitions (`src/types/index.ts`)
- Added `enableImageGeneration?: boolean` field to the `AIConfig` interface
- Defaults to `true` to maintain backward compatibility

### 2. Settings Panel (`src/components/SettingsPanel.tsx`)
- Added `enableImageGeneration` to the form state
- Added a new toggle checkbox in the UI labeled "Enable Image Generation"
- Wrapped the entire "Separate Image Generation Configuration" section in a conditional that only shows when image generation is enabled
- Updated form validation and save logic to include the new setting

### 3. Game Manager (`src/components/GameManager.tsx`)
- Modified `generateImageForStory()` to check `aiConfig.enableImageGeneration` before attempting to generate images
- Returns `null` immediately if image generation is disabled
- Passes the `enableImageGeneration` setting to the `StoryDisplay` component

### 4. Story Display (`src/components/StoryDisplay.tsx`)
- Added `enableImageGeneration` prop to the component interface (defaults to `true`)
- Conditionally renders the `ImageDisplay` component only when `enableImageGeneration` is `true`
- Images are completely hidden from the UI when disabled

### 5. Story Service (`src/services/StoryService.ts`)
- **OPTIMIZED**: Modified prompt generation to conditionally include SCENE descriptions
- `generateInitialStoryPrompt()` now accepts `includeScene` parameter
- `generateContinuationPrompt()` now accepts `includeScene` parameter
- When image generation is disabled, the LLM is NOT asked to generate scene descriptions
- This reduces token usage and processing time for the LLM
- All story generation methods check `config.enableImageGeneration` and pass the flag to prompt generators

### 6. Validation Utilities (`src/utils/validation.ts`)
- Updated `sanitizeConfig()` to preserve the `enableImageGeneration` boolean setting

## User Experience

### When Enabled (Default)
- Images are generated for each story scene
- LLM generates scene descriptions for image generation
- ImageDisplay component shows loading states, errors, and retry options
- Full visual experience as before

### When Disabled
- No images are generated or displayed
- **LLM does NOT generate scene descriptions** (saves tokens and processing time)
- Faster story generation (no waiting for image API calls)
- Cleaner, text-only interface
- Image configuration section is hidden in settings

## How to Use

1. Open Settings Panel
2. Find the "Enable Image Generation" checkbox (above the image configuration section)
3. Uncheck to disable image generation
4. Check to enable image generation
5. Save settings

The setting persists across sessions and applies to all new and resumed games.

## Benefits

- **Performance**: Faster story generation without image API calls
- **Token Efficiency**: LLM doesn't waste tokens generating scene descriptions when images are disabled
- **Cost**: Reduces API costs for both text and image generation
- **Flexibility**: Users can choose their preferred experience
- **Accessibility**: Text-only mode may be preferred by some users
- **Bandwidth**: Reduces data usage for users on limited connections

## Technical Details

### Prompt Optimization
When `enableImageGeneration` is `false`:
- The prompt does NOT include "Include a brief scene description for potential image generation"
- The prompt format does NOT include the `SCENE:` section
- The LLM response parser handles missing scene sections gracefully
- A generic placeholder scene description is used internally (not shown to users)

This optimization ensures the LLM focuses entirely on story generation without the overhead of visual descriptions.
