# Story Regeneration Feature

## Overview

The regenerate feature allows users to regenerate the latest story response using the same context if they don't like the current result. This provides users with more control over their story experience and helps them get variations they prefer.

## How It Works

### User Interface
- A "Regenerate" button appears in the story display area when a story is active
- The button is only visible when:
  - A story segment exists
  - The system is not currently loading or streaming
  - The game is in an active state

### Functionality
- **Initial Stories**: If no choices have been made yet, regenerates the opening story segment
- **Continued Stories**: If choices have been made, regenerates the latest story continuation using the same choice/action context
- **Custom Mode**: Works with both standard and custom scenario modes
- **Streaming Support**: Supports both streaming and non-streaming generation modes

### Technical Implementation

#### Services Enhanced
1. **CustomStoryService**: Added regenerate methods for custom scenarios
   - `regenerateCustomInitialStoryStream()` / `regenerateCustomInitialStory()`
   - `regenerateCustomStoryStream()` / `regenerateCustomStory()`

2. **StoryService**: Added regenerate methods for standard stories
   - `regenerateInitialStoryStream()` / `regenerateInitialStory()`
   - `regenerateStoryStream()` / `regenerateStory()`

#### Key Features
- **Increased Temperature**: Regeneration uses slightly higher temperature (+0.1) to encourage variation
- **Same Context**: Uses identical story context and choice history for consistency
- **Auto-Save**: Automatically saves the regenerated story
- **Image Generation**: Generates new images for regenerated stories
- **Error Handling**: Proper error handling and loading states

#### Components Updated
1. **StoryDisplay**: Added regenerate button and props
2. **GameManager**: Added regenerate handler and logic

## Usage

1. Start or continue a story as normal
2. If you don't like the current story response, click the "Regenerate" button
3. The system will generate a new variation using the same context
4. The new story replaces the current one and is automatically saved
5. A new scene image is generated if image generation is enabled

## Benefits

- **User Control**: Gives users more agency over their story experience
- **Quality Improvement**: Allows users to get better responses without losing progress
- **Experimentation**: Users can explore different narrative directions
- **Seamless Integration**: Works with existing save/load and streaming features