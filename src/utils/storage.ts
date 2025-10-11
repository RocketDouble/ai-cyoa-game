import type { AIConfig, AppSettings, SavedGame, GameState } from '../types';

// Storage keys
const STORAGE_KEYS = {
  AI_CONFIG: 'cyoa_ai_config',
  APP_SETTINGS: 'cyoa_app_settings',
  SAVED_GAMES: 'cyoa_saved_games',
} as const;

// Storage version for migration support
const STORAGE_VERSION = '1.0.0';

// Validation schemas
interface SavedGameValidation {
  gameId: string;
  gameState: GameState;
  metadata: {
    title: string;
    createdAt: string | Date;
    lastPlayed: string | Date;
    choiceCount: number;
    gameMode?: 'standard' | 'custom';
  };
  version?: string;
}

interface GameStateValidation {
  currentStory: {
    id: string;
    text: string;
    imageUrl?: string;
    choices: Array<{ id: string; text: string; selected?: boolean }>;
    sceneDescription: string;
  };
  storyHistory: Array<{
    id: string;
    text: string;
    imageUrl?: string;
    choices: Array<{ id: string; text: string; selected?: boolean }>;
    sceneDescription: string;
  }>;
  choiceHistory: Array<{ id: string; text: string; selected?: boolean }>;
  gameId: string;
  createdAt: string | Date;
  lastUpdated: string | Date;
  gameMode?: 'standard' | 'custom';
  customScene?: string;
}

/**
 * Secure localStorage wrapper for API key storage
 * Provides encryption-like obfuscation for API keys (basic security)
 */
class SecureStorage {
  private static encode(value: string): string {
    // Simple base64 encoding for basic obfuscation
    // Note: This is not true encryption, just obfuscation
    return btoa(value);
  }

  private static decode(value: string): string {
    try {
      return atob(value);
    } catch {
      return value; // Return as-is if decoding fails
    }
  }

  static setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, this.encode(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      throw new Error('Failed to save configuration');
    }
  }

  static getItem(key: string): string | null {
    try {
      const item = localStorage.getItem(key);
      return item ? this.decode(item) : null;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return null;
    }
  }

  static removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  }
}

/**
 * AI Configuration storage utilities
 */
export class AIConfigStorage {
  /**
   * Save AI configuration to secure storage
   */
  static saveConfig(config: AIConfig): void {
    try {
      const configData = JSON.stringify(config);
      SecureStorage.setItem(STORAGE_KEYS.AI_CONFIG, configData);
    } catch (error) {
      console.error('Failed to save AI config:', error);
      throw new Error('Failed to save AI configuration');
    }
  }

  /**
   * Load AI configuration from storage
   */
  static loadConfig(): AIConfig | null {
    try {
      const configData = SecureStorage.getItem(STORAGE_KEYS.AI_CONFIG);
      if (!configData) return null;

      const config = JSON.parse(configData) as AIConfig;
      return config;
    } catch (error) {
      console.error('Failed to load AI config:', error);
      return null;
    }
  }

  /**
   * Remove AI configuration from storage
   */
  static clearConfig(): void {
    SecureStorage.removeItem(STORAGE_KEYS.AI_CONFIG);
  }

  /**
   * Check if AI configuration exists
   */
  static hasConfig(): boolean {
    return SecureStorage.getItem(STORAGE_KEYS.AI_CONFIG) !== null;
  }
}

/**
 * General app settings storage utilities
 */
export class AppSettingsStorage {
  /**
   * Save complete app settings
   */
  static saveSettings(settings: AppSettings): void {
    try {
      const settingsData = JSON.stringify(settings);
      localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, settingsData);
    } catch (error) {
      console.error('Failed to save app settings:', error);
      throw new Error('Failed to save application settings');
    }
  }

  /**
   * Load complete app settings
   */
  static loadSettings(): AppSettings | null {
    try {
      const settingsData = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
      if (!settingsData) return null;

      return JSON.parse(settingsData) as AppSettings;
    } catch (error) {
      console.error('Failed to load app settings:', error);
      return null;
    }
  }
}

/**
 * Game state serialization utilities
 */
export class GameStateSerializer {
  /**
   * Serialize game state to JSON string with proper date handling
   */
  static serialize(gameState: GameState): string {
    try {
      const serializedState = {
        ...gameState,
        createdAt: gameState.createdAt.toISOString(),
        lastUpdated: gameState.lastUpdated.toISOString(),
        version: STORAGE_VERSION
      };
      return JSON.stringify(serializedState);
    } catch (error) {
      console.error('Failed to serialize game state:', error);
      throw new Error('Failed to serialize game state');
    }
  }

  /**
   * Deserialize game state from JSON string with proper date parsing
   */
  static deserialize(data: string): GameState {
    try {
      const parsed = JSON.parse(data);
      
      // Validate the parsed data
      if (!this.validateGameState(parsed)) {
        throw new Error('Invalid game state format');
      }

      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        lastUpdated: new Date(parsed.lastUpdated),
        gameMode: parsed.gameMode || 'standard'
      };
    } catch (error) {
      console.error('Failed to deserialize game state:', error);
      throw new Error('Failed to deserialize game state');
    }
  }

  /**
   * Validate game state structure
   */
  private static validateGameState(data: unknown): data is GameStateValidation {
    if (!data || typeof data !== 'object') return false;
    
    const obj = data as Record<string, unknown>;
    
    // Check required fields
    if (!obj.gameId || typeof obj.gameId !== 'string') return false;
    if (!obj.createdAt || !obj.lastUpdated) return false;
    if (!obj.currentStory || typeof obj.currentStory !== 'object') return false;
    if (!Array.isArray(obj.storyHistory)) return false;
    if (!Array.isArray(obj.choiceHistory)) return false;

    // Validate current story structure
    const story = obj.currentStory as Record<string, unknown>;
    if (!story.id || !story.text || !story.sceneDescription) return false;
    if (!Array.isArray(story.choices)) return false;

    // Validate choices structure
    for (const choice of story.choices) {
      const choiceObj = choice as Record<string, unknown>;
      if (!choiceObj.id || !choiceObj.text) return false;
    }

    return true;
  }
}

/**
 * Saved game serialization utilities
 */
export class SavedGameSerializer {
  /**
   * Serialize saved game with metadata
   */
  static serialize(savedGame: SavedGame): string {
    try {
      const serializedGame = {
        ...savedGame,
        gameState: {
          ...savedGame.gameState,
          createdAt: savedGame.gameState.createdAt.toISOString(),
          lastUpdated: savedGame.gameState.lastUpdated.toISOString()
        },
        metadata: {
          ...savedGame.metadata,
          createdAt: savedGame.metadata.createdAt.toISOString(),
          lastPlayed: savedGame.metadata.lastPlayed.toISOString()
        },
        version: STORAGE_VERSION
      };
      return JSON.stringify(serializedGame);
    } catch (error) {
      console.error('Failed to serialize saved game:', error);
      throw new Error('Failed to serialize saved game');
    }
  }

  /**
   * Deserialize saved game with proper date parsing
   */
  static deserialize(data: string): SavedGame {
    try {
      const parsed = JSON.parse(data);
      
      // Validate the parsed data
      if (!this.validateSavedGame(parsed)) {
        throw new Error('Invalid saved game format');
      }

      return {
        ...parsed,
        gameState: {
          ...parsed.gameState,
          createdAt: new Date(parsed.gameState.createdAt),
          lastUpdated: new Date(parsed.gameState.lastUpdated),
          gameMode: parsed.gameState.gameMode || 'standard',
          // Preserve customScene for custom mode games
          customScene: parsed.gameState.customScene
        },
        metadata: {
          ...parsed.metadata,
          createdAt: new Date(parsed.metadata.createdAt),
          lastPlayed: new Date(parsed.metadata.lastPlayed),
          gameMode: parsed.metadata.gameMode || parsed.gameState.gameMode || 'standard'
        }
      };
    } catch (error) {
      console.error('Failed to deserialize saved game:', error);
      throw new Error('Failed to deserialize saved game');
    }
  }

  /**
   * Validate saved game structure
   */
  private static validateSavedGame(data: unknown): data is SavedGameValidation {
    if (!data || typeof data !== 'object') return false;
    
    const obj = data as Record<string, unknown>;
    
    // Check required fields
    if (!obj.gameId || typeof obj.gameId !== 'string') return false;
    if (!obj.gameState || typeof obj.gameState !== 'object') return false;
    if (!obj.metadata || typeof obj.metadata !== 'object') return false;

    // Validate metadata
    const metadata = obj.metadata as Record<string, unknown>;
    if (!metadata.title || typeof metadata.title !== 'string') return false;
    if (!metadata.createdAt || !metadata.lastPlayed) return false;
    if (typeof metadata.choiceCount !== 'number') return false;

    // Validate game state using GameStateSerializer
    return GameStateSerializer['validateGameState'](obj.gameState);
  }
}

/**
 * Enhanced saved games storage utilities with validation and corruption handling
 */
export class SavedGamesStorage {
  private static readonly MAX_SAVED_GAMES = 10; // Limit to prevent quota issues
  private static readonly MAX_HISTORY_ITEMS = 20; // Limit history to save space

  /**
   * Compress game state by removing unnecessary data
   */
  private static compressGameState(game: SavedGame): SavedGame {
    return {
      ...game,
      gameState: {
        ...game.gameState,
        // Keep only recent history to save space
        storyHistory: game.gameState.storyHistory.slice(-this.MAX_HISTORY_ITEMS).map(story => ({
          ...story,
          imageUrl: undefined // Remove image URLs from history - they can be regenerated
        })),
        choiceHistory: game.gameState.choiceHistory.slice(-this.MAX_HISTORY_ITEMS)
      }
    };
  }

  /**
   * Save a game to storage with validation and corruption handling
   */
  static saveGame(game: SavedGame): void {
    try {
      // Compress the game to save space
      const compressedGame = this.compressGameState(game);
      
      // Validate the game before saving
      const serializedGame = SavedGameSerializer.serialize(compressedGame);
      
      // Test deserialization to ensure data integrity
      SavedGameSerializer.deserialize(serializedGame);

      const games = this.loadAllGames();
      const updatedGames = games.filter(g => g.gameId !== game.gameId);
      updatedGames.push(compressedGame);
      
      // Sort games by last played date (most recent first)
      updatedGames.sort((a, b) => 
        new Date(b.metadata.lastPlayed).getTime() - new Date(a.metadata.lastPlayed).getTime()
      );

      // Keep only the most recent games to prevent quota issues
      const gamesToSave = updatedGames.slice(0, this.MAX_SAVED_GAMES);

      const gamesData = JSON.stringify(gamesToSave.map(g => SavedGameSerializer.serialize(g)));
      
      try {
        localStorage.setItem(STORAGE_KEYS.SAVED_GAMES, gamesData);
      } catch (quotaError) {
        // If quota exceeded, try removing oldest games one by one
        if (quotaError instanceof DOMException && quotaError.name === 'QuotaExceededError') {
          console.warn('Storage quota exceeded, removing old saves...');
          for (let i = gamesToSave.length - 1; i >= 1; i--) {
            try {
              const reducedGames = gamesToSave.slice(0, i);
              const reducedData = JSON.stringify(reducedGames.map(g => SavedGameSerializer.serialize(g)));
              localStorage.setItem(STORAGE_KEYS.SAVED_GAMES, reducedData);
              console.log(`Successfully saved with ${i} games (removed ${gamesToSave.length - i} old saves)`);
              return;
            } catch {
              continue;
            }
          }
          throw new Error('Storage quota exceeded even after removing old saves');
        }
        throw quotaError;
      }
    } catch (error) {
      console.error('Failed to save game:', error);
      throw new Error('Failed to save game: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Load all saved games with corruption handling
   */
  static loadAllGames(): SavedGame[] {
    try {
      const gamesData = localStorage.getItem(STORAGE_KEYS.SAVED_GAMES);
      if (!gamesData) return [];

      const serializedGames = JSON.parse(gamesData) as string[];
      const validGames: SavedGame[] = [];
      const corruptedGameIds: string[] = [];

      for (const serializedGame of serializedGames) {
        try {
          const game = SavedGameSerializer.deserialize(serializedGame);
          validGames.push(game);
        } catch (error) {
          console.warn('Corrupted game data found, skipping:', error);
          // Try to extract game ID for reporting
          try {
            const partial = JSON.parse(serializedGame);
            if (partial.gameId) {
              corruptedGameIds.push(partial.gameId);
            }
          } catch {
            // Ignore if we can't even parse the game ID
          }
        }
      }

      // If we found corrupted games, clean up the storage
      if (corruptedGameIds.length > 0) {
        console.warn(`Found ${corruptedGameIds.length} corrupted games, cleaning up storage`);
        this.cleanupCorruptedGames(validGames);
      }

      return validGames;
    } catch (error) {
      console.error('Failed to load saved games:', error);
      // Return empty array and clear corrupted storage
      this.clearAllGames();
      return [];
    }
  }

  /**
   * Load a specific game by ID with corruption handling
   */
  static loadGame(gameId: string): SavedGame | null {
    try {
      const games = this.loadAllGames();
      return games.find(game => game.gameId === gameId) || null;
    } catch (error) {
      console.error('Failed to load game:', error);
      return null;
    }
  }

  /**
   * Delete a saved game
   */
  static deleteGame(gameId: string): void {
    try {
      const games = this.loadAllGames();
      const filteredGames = games.filter(game => game.gameId !== gameId);
      
      const gamesData = JSON.stringify(filteredGames.map(g => SavedGameSerializer.serialize(g)));
      localStorage.setItem(STORAGE_KEYS.SAVED_GAMES, gamesData);
    } catch (error) {
      console.error('Failed to delete game:', error);
      throw new Error('Failed to delete game');
    }
  }

  /**
   * Get the most recently played game
   */
  static getMostRecentGame(): SavedGame | null {
    const games = this.loadAllGames();
    if (games.length === 0) return null;

    return games.reduce((latest, game) => 
      new Date(game.metadata.lastPlayed) > new Date(latest.metadata.lastPlayed) ? game : latest
    );
  }

  /**
   * Check if a game exists
   */
  static hasGame(gameId: string): boolean {
    const games = this.loadAllGames();
    return games.some(game => game.gameId === gameId);
  }

  /**
   * Get total number of saved games
   */
  static getGameCount(): number {
    return this.loadAllGames().length;
  }

  /**
   * Clear all saved games
   */
  static clearAllGames(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SAVED_GAMES);
    } catch (error) {
      console.error('Failed to clear saved games:', error);
    }
  }

  /**
   * Clean up corrupted games from storage
   */
  private static cleanupCorruptedGames(validGames: SavedGame[]): void {
    try {
      const gamesData = JSON.stringify(validGames.map(g => SavedGameSerializer.serialize(g)));
      localStorage.setItem(STORAGE_KEYS.SAVED_GAMES, gamesData);
    } catch (error) {
      console.error('Failed to cleanup corrupted games:', error);
    }
  }

  /**
   * Validate storage integrity and repair if needed
   */
  static validateAndRepairStorage(): { isValid: boolean; repairedCount: number; errors: string[] } {
    const result = {
      isValid: true,
      repairedCount: 0,
      errors: [] as string[]
    };

    try {
      const games = this.loadAllGames();
      const originalCount = this.getStorageItemCount();
      
      if (games.length < originalCount) {
        result.repairedCount = originalCount - games.length;
        result.isValid = false;
        result.errors.push(`Repaired ${result.repairedCount} corrupted game(s)`);
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown storage error');
      return result;
    }
  }

  /**
   * Get raw storage item count (for validation)
   */
  private static getStorageItemCount(): number {
    try {
      const gamesData = localStorage.getItem(STORAGE_KEYS.SAVED_GAMES);
      if (!gamesData) return 0;
      
      const serializedGames = JSON.parse(gamesData) as string[];
      return serializedGames.length;
    } catch {
      return 0;
    }
  }

  /**
   * Get storage usage information
   */
  static getStorageInfo(): { 
    gameCount: number; 
    estimatedSize: number; 
    maxGames: number;
    canSaveMore: boolean;
  } {
    try {
      const gamesData = localStorage.getItem(STORAGE_KEYS.SAVED_GAMES);
      const estimatedSize = gamesData ? new Blob([gamesData]).size : 0;
      const gameCount = this.getGameCount();
      
      return {
        gameCount,
        estimatedSize,
        maxGames: this.MAX_SAVED_GAMES,
        canSaveMore: gameCount < this.MAX_SAVED_GAMES
      };
    } catch {
      return {
        gameCount: 0,
        estimatedSize: 0,
        maxGames: this.MAX_SAVED_GAMES,
        canSaveMore: true
      };
    }
  }

  /**
   * Remove oldest games to free up space
   */
  static pruneOldGames(keepCount: number = 5): number {
    try {
      const games = this.loadAllGames();
      if (games.length <= keepCount) return 0;

      // Sort by last played (most recent first)
      games.sort((a, b) => 
        new Date(b.metadata.lastPlayed).getTime() - new Date(a.metadata.lastPlayed).getTime()
      );

      const gamesToKeep = games.slice(0, keepCount);
      const removedCount = games.length - keepCount;

      const gamesData = JSON.stringify(gamesToKeep.map(g => SavedGameSerializer.serialize(g)));
      localStorage.setItem(STORAGE_KEYS.SAVED_GAMES, gamesData);

      return removedCount;
    } catch (error) {
      console.error('Failed to prune old games:', error);
      return 0;
    }
  }
}