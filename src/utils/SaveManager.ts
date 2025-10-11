import { SavedGamesStorage } from './storage';
import type { GameState, SavedGame } from '../types';

/**
 * SaveManager handles automatic saving, save conflicts, and data integrity
 * for the game state management system.
 * 
 * Requirements addressed:
 * - 5.1: Automatically save story progress at each choice point
 * - 5.2: Store all custom actions in the choice history
 * - 5.3: Handle save conflicts and data integrity
 * - 5.4: Restore game in correct mode (standard or custom)
 * - 5.5: Display visual indicator for custom scenario saves
 * - 5.6: Restore all story segments and custom actions
 * 
 * Custom Mode Support:
 * - Saves gameMode field with all game states
 * - Preserves customScene for custom mode games
 * - Validates custom scene length (20-300 characters)
 * - Migrates existing saves to 'standard' mode by default
 * - Generates appropriate titles for custom mode games
 */
export class SaveManager {
  private static saveQueue: Map<string, NodeJS.Timeout> = new Map();
  private static readonly SAVE_DEBOUNCE_MS = 1000;
  private static readonly MAX_SAVE_ATTEMPTS = 3;

  /**
   * Schedule an automatic save with debouncing to prevent excessive saves
   */
  static scheduleAutoSave(gameState: GameState): void {
    const gameId = gameState.gameId;
    
    // Clear existing timeout for this game
    const existingTimeout = this.saveQueue.get(gameId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new save
    const timeout = setTimeout(() => {
      this.performAutoSave(gameState);
      this.saveQueue.delete(gameId);
    }, this.SAVE_DEBOUNCE_MS);

    this.saveQueue.set(gameId, timeout);
  }

  /**
   * Perform immediate save without debouncing (for critical save points)
   */
  static async performImmediateSave(gameState: GameState): Promise<boolean> {
    const gameId = gameState.gameId;
    
    // Clear any pending auto-save for this game
    const existingTimeout = this.saveQueue.get(gameId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.saveQueue.delete(gameId);
    }

    return this.performAutoSave(gameState);
  }

  /**
   * Internal method to perform the actual save operation with retry logic
   */
  private static async performAutoSave(gameState: GameState, attempt: number = 1): Promise<boolean> {
    try {
      // Check for save conflicts by comparing timestamps
      const existingGame = SavedGamesStorage.loadGame(gameState.gameId);
      if (existingGame && this.hasConflict(gameState, existingGame.gameState)) {
        console.warn('Save conflict detected, resolving...');
        const resolvedState = this.resolveConflict(gameState, existingGame.gameState);
        return this.saveGameState(resolvedState);
      }

      return this.saveGameState(gameState);
    } catch (error) {
      console.error(`Auto-save attempt ${attempt} failed:`, error);
      
      if (attempt < this.MAX_SAVE_ATTEMPTS) {
        // Exponential backoff for retries
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.performAutoSave(gameState, attempt + 1);
      }
      
      console.error('Auto-save failed after maximum attempts');
      return false;
    }
  }

  /**
   * Save the game state to storage
   */
  private static saveGameState(gameState: GameState): boolean {
    try {
      // Ensure gameMode is set (migration support)
      const normalizedGameState: GameState = {
        ...gameState,
        gameMode: gameState.gameMode || 'standard',
        // Ensure customScene is preserved for custom mode games
        customScene: gameState.gameMode === 'custom' ? gameState.customScene : undefined
      };

      const savedGame: SavedGame = {
        gameId: normalizedGameState.gameId,
        gameState: normalizedGameState,
        metadata: {
          title: this.generateGameTitle(normalizedGameState),
          createdAt: normalizedGameState.createdAt,
          lastPlayed: new Date(),
          choiceCount: normalizedGameState.choiceHistory.length,
          gameMode: normalizedGameState.gameMode
        }
      };

      SavedGamesStorage.saveGame(savedGame);
      return true;
    } catch (error) {
      console.error('Failed to save game state:', error);
      return false;
    }
  }

  /**
   * Check if there's a save conflict between two game states
   */
  private static hasConflict(newState: GameState, existingState: GameState): boolean {
    // Check if the existing state is newer than what we're trying to save
    const newTimestamp = newState.lastUpdated.getTime();
    const existingTimestamp = existingState.lastUpdated.getTime();
    
    // If existing state is significantly newer (more than 5 seconds), it's a conflict
    return existingTimestamp > newTimestamp + 5000;
  }

  /**
   * Resolve save conflicts by merging states intelligently
   */
  private static resolveConflict(newState: GameState, existingState: GameState): GameState {
    // Use the state with more progress (more choices made)
    if (existingState.choiceHistory.length > newState.choiceHistory.length) {
      console.log('Resolving conflict: keeping existing state (more progress)');
      return {
        ...existingState,
        lastUpdated: new Date() // Update timestamp to current
      };
    }
    
    // If same progress, use the newer timestamp
    if (existingState.choiceHistory.length === newState.choiceHistory.length) {
      const useExisting = existingState.lastUpdated > newState.lastUpdated;
      console.log(`Resolving conflict: using ${useExisting ? 'existing' : 'new'} state (same progress, newer timestamp)`);
      return useExisting ? existingState : newState;
    }
    
    // New state has more progress, use it
    console.log('Resolving conflict: using new state (more progress)');
    return newState;
  }

  /**
   * Generate a descriptive title for the game based on its content
   */
  private static generateGameTitle(gameState: GameState): string {
    const choiceCount = gameState.choiceHistory.length;
    const gameIdShort = gameState.gameId.slice(0, 8);
    const modeLabel = gameState.gameMode === 'custom' ? 'Custom' : 'Adventure';
    
    // For custom mode, try to use the custom scene as title
    if (gameState.gameMode === 'custom' && gameState.customScene) {
      const sceneWords = gameState.customScene.trim().split(' ').filter(word => 
        word.length > 3 && 
        !['the', 'and', 'but', 'for', 'are', 'with', 'they', 'have', 'this', 'that', 'from', 'your', 'you'].includes(word.toLowerCase())
      );
      
      if (sceneWords.length >= 2) {
        const title = sceneWords.slice(0, 3).join(' ');
        return `${title}... (${choiceCount} actions)`;
      }
    }
    
    // Try to extract a meaningful title from the story
    const storyText = gameState.currentStory.text;
    const sentences = storyText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      // Extract key words for title
      const words = firstSentence.split(' ').filter(word => 
        word.length > 3 && 
        !['the', 'and', 'but', 'for', 'are', 'with', 'they', 'have', 'this', 'that', 'from', 'your', 'you'].includes(word.toLowerCase())
      );
      
      if (words.length >= 2) {
        const title = words.slice(0, 3).join(' ');
        const actionLabel = gameState.gameMode === 'custom' ? 'actions' : 'choices';
        return `${title}... (${choiceCount} ${actionLabel})`;
      }
    }
    
    // Fallback to generic title
    const actionLabel = gameState.gameMode === 'custom' ? 'actions' : 'choices';
    return `${modeLabel} ${gameIdShort} (${choiceCount} ${actionLabel})`;
  }

  /**
   * Validate game state integrity before saving
   */
  static validateGameState(gameState: GameState): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!gameState.gameId) errors.push('Missing game ID');
    if (!gameState.currentStory) errors.push('Missing current story');
    if (!gameState.createdAt) errors.push('Missing creation date');
    if (!gameState.lastUpdated) errors.push('Missing last updated date');

    // Validate game mode
    if (!gameState.gameMode) {
      errors.push('Missing game mode');
    } else if (gameState.gameMode !== 'standard' && gameState.gameMode !== 'custom') {
      errors.push('Invalid game mode (must be "standard" or "custom")');
    }

    // Validate custom mode specific fields
    if (gameState.gameMode === 'custom') {
      if (!gameState.customScene || gameState.customScene.trim().length === 0) {
        errors.push('Custom mode game missing custom scene description');
      } else if (gameState.customScene.trim().length < 20) {
        errors.push('Custom scene description too short (minimum 20 characters)');
      } else if (gameState.customScene.trim().length > 500) {
        errors.push('Custom scene description too long (maximum 500 characters)');
      }
    }

    // Check story structure
    if (gameState.currentStory) {
      if (!gameState.currentStory.id) errors.push('Missing story ID');
      if (!gameState.currentStory.text) errors.push('Missing story text');
      if (!gameState.currentStory.sceneDescription) errors.push('Missing scene description');
      if (!Array.isArray(gameState.currentStory.choices)) errors.push('Invalid choices array');
    }

    // Check arrays
    if (!Array.isArray(gameState.storyHistory)) errors.push('Invalid story history');
    if (!Array.isArray(gameState.choiceHistory)) errors.push('Invalid choice history');

    // Check data consistency
    if (gameState.choiceHistory.length > 0 && gameState.storyHistory.length !== gameState.choiceHistory.length) {
      errors.push('Story history and choice history length mismatch');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean up any pending saves (call on component unmount)
   */
  static cleanup(): void {
    for (const [, timeout] of this.saveQueue.entries()) {
      clearTimeout(timeout);
    }
    this.saveQueue.clear();
  }

  /**
   * Get save statistics for debugging
   */
  static getSaveStats(): { pendingSaves: number; queuedGames: string[] } {
    return {
      pendingSaves: this.saveQueue.size,
      queuedGames: Array.from(this.saveQueue.keys())
    };
  }
}