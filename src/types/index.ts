// Core interfaces for the AI-driven CYOA game

export type GameMode = 'standard' | 'custom';

export interface GameState {
  currentStory: StorySegment;
  storyHistory: StorySegment[];
  choiceHistory: Choice[];
  gameId: string;
  createdAt: Date;
  lastUpdated: Date;
  gameMode: GameMode;
  customScene?: string;
}

export interface StorySegment {
  id: string;
  text: string;
  imageUrl?: string;
  choices: Choice[];
  sceneDescription: string;
  thinkingContent?: string; // AI's thinking process for this segment
}

export interface Choice {
  id: string;
  text: string;
  selected?: boolean;
  isCustom?: boolean;
}

export type ImageProvider = 'openai' | 'nano-gpt';

export interface SamplerSettings {
  temperature: number;
  minP: number;
  repetitionPenalty: number;
  enableStreaming?: boolean;
}

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  availableModels?: string[];
  samplerSettings?: SamplerSettings;
  enableImageGeneration?: boolean; // Toggle for image generation feature
  // Image generation configuration (optional - falls back to text config if not provided)
  imageConfig?: {
    provider: ImageProvider;
    apiKey?: string; // If not provided, uses main apiKey
    baseUrl?: string; // If not provided, uses main baseUrl
    model: string;
    availableModels?: string[];
  };
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

// Additional supporting interfaces

export interface StoryContext {
  storyHistory: StorySegment[];
  choiceHistory: Choice[];
  currentScene: string;
}

export interface SavedGame {
  gameId: string;
  gameState: GameState;
  metadata: {
    title: string;
    createdAt: Date;
    lastPlayed: Date;
    choiceCount: number;
    gameMode: GameMode;
  };
}

export interface AppSettings {
  apiConfig: AIConfig;
  preferences: UserPreferences;
  savedGames: SavedGame[];
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto';
  fontSize?: 'small' | 'medium' | 'large';
  autoSave?: boolean;
}