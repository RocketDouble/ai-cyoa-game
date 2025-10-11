# Sampler Settings Feature

## Overview
The sampler settings feature allows users to control AI generation parameters during gameplay, giving them fine-grained control over story generation behavior.

## Current Settings

### Temperature (0.0 - 2.0)
- Controls randomness in text generation
- Lower values (0.3-0.7): More focused and deterministic output
- Higher values (0.8-1.5): More creative and varied output
- Default: 0.7

### Min P (0.0 - 0.5)
- Minimum probability threshold for token selection
- Filters out unlikely tokens to improve coherence
- Lower values: More diverse vocabulary
- Higher values: More conservative word choices
- Default: 0.05

### Repetition Penalty (1.0 - 2.0)
- Reduces repetitive text in generated content
- 1.0: No penalty
- Higher values: Stronger penalty against repetition
- Default: 1.1

## User Interface

The sampler settings are accessible via a "Sampler" button in three locations:
1. **Game Launcher** - Top-right corner of the welcome screen (before selecting a game)
2. **Ready for Adventure** - Top-right corner of the "Ready for Adventure" screen (after clicking "Start New Adventure")
3. **Story Display** - Top-right area while playing (during active gameplay)

Clicking the button opens a modal with sliders for each setting, showing real-time value updates. Settings can be adjusted at any point in the user journey.

## Architecture

### Components
- **SamplerSettings.tsx**: Modal component for adjusting settings
- **GameLauncher.tsx**: Displays the settings button on the welcome screen
- **StoryDisplay.tsx**: Displays the settings button during gameplay
- **GameManager.tsx**: Manages sampler settings state and passes to StoryService

### Data Flow
1. User adjusts settings in SamplerSettings modal
2. Settings saved to GameManager state
3. GameManager passes settings to StoryService on each generation
4. StoryService passes settings to AIService
5. AIService includes settings in API request

## Adding New Settings

To add a new sampler setting:

1. **Update Type Definition** (`src/types/index.ts`):
   ```typescript
   export interface SamplerSettings {
     temperature: number;
     minP: number;
     repetitionPenalty: number;
     newSetting: number; // Add your new setting
   }
   ```

2. **Update Default Settings** (`src/components/SamplerSettings.tsx`):
   ```typescript
   const DEFAULT_SETTINGS: SamplerSettingsType = {
     temperature: 0.7,
     minP: 0.05,
     repetitionPenalty: 1.1,
     newSetting: 1.0 // Add default value
   };
   ```

3. **Add UI Control** (`src/components/SamplerSettings.tsx`):
   Add a new settings section following the existing pattern:
   ```tsx
   <div>
     <div className="flex justify-between items-center mb-2">
       <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
         New Setting
       </label>
       <span className="text-sm text-gray-600 dark:text-gray-400">
         {localSettings.newSetting.toFixed(2)}
       </span>
     </div>
     <input
       type="range"
       min="0"
       max="2"
       step="0.01"
       value={localSettings.newSetting}
       onChange={(e) => handleChange('newSetting', parseFloat(e.target.value))}
       className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
     />
     <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
       Description of what this setting does
     </p>
   </div>
   ```

4. **Update AIService** (if needed) (`src/services/AIService.ts`):
   If the new setting needs to be sent to the API, add it to the request body in the `chatCompletion` method.

## Persistence

Sampler settings are automatically persisted to localStorage as part of the AIConfig. This means:
- Settings survive page refreshes and browser restarts
- Settings are loaded automatically when the app starts
- Changes are saved immediately when you click "Save Changes" in the modal
- Settings are reloaded when navigating between views (launcher ↔ game)
- Settings are stored securely using the same storage mechanism as API keys

### How Persistence Works:
1. User adjusts settings in the Sampler Settings modal
2. On "Save Changes", GameManager saves to localStorage via AIConfigStorage
3. When navigating to/from game view, App.tsx reloads config from storage
4. GameManager receives updated config and applies settings to story generation

## Notes

- Settings are automatically saved to localStorage when changed
- Settings persist across page refreshes and browser sessions
- The modal uses a local state copy that only updates on "Save Changes"
- "Reset to Defaults" button restores factory defaults (0.7 temp, 0.05 minP, 1.1 repetition penalty)
- Settings are stored as part of the AIConfig in secure storage
