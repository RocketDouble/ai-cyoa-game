import React, { useState, useCallback, useEffect } from 'react';
import { StoryDisplay } from './StoryDisplay';
import { ChoicePanel } from './ChoicePanel';
import { CustomActionPanel } from './CustomActionPanel';
import { SamplerSettings as SamplerSettingsModal } from './SamplerSettings';
import { RollbackConfirmationDialog } from './RollbackConfirmationDialog';
import { StoryService } from '../services/StoryService';
import { CustomStoryService } from '../services/CustomStoryService';
import { ImageService } from '../services/ImageService';

import { SaveManager } from '../utils/SaveManager';
import { AIConfigStorage } from '../utils/storage';
import type { GameState, Choice, AIConfig, StoryContext, SavedGame, StorySegment, SamplerSettings, GameMode } from '../types';

interface GameManagerProps {
  aiConfig: AIConfig | null;
  onConfigurationNeeded: () => void;
  onBackToLauncher?: () => void;
  onNewGame?: () => void;
  gameToResume?: SavedGame | null;
  gameMode?: GameMode;
  customScene?: string;
}

/**
 * GameManager component serves as the central orchestrator for game state management,
 * coordinating between story generation and UI components, and handling game flow.
 * 
 * Requirements addressed:
 * - 2.1: Generate initial story scenario using AI
 * - 2.6: Store custom actions in choice history
 * - 3.1: Send choice context to AI for story continuation
 * - 3.2: Generate next story segment based on user decisions
 * - 3.4: Maintain narrative continuity from previous segments
 * - 3.5, 3.6: Call appropriate StoryService methods for custom mode
 * - 6.1-6.5: Prevent mode switching during active gameplay
 */
export const GameManager: React.FC<GameManagerProps> = ({
  aiConfig,
  onConfigurationNeeded,
  onBackToLauncher,
  onNewGame,
  gameToResume,
  gameMode,
  customScene
}) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedOperation, setLastFailedOperation] = useState<{
    type: 'initial' | 'choice' | 'custom-action' | 'custom-initial';
    data?: string | Choice;
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showSamplerSettings, setShowSamplerSettings] = useState(false);
  const [samplerSettings, setSamplerSettings] = useState<SamplerSettings>(
    aiConfig?.samplerSettings || {
      temperature: 0.7,
      minP: 0.05,
      repetitionPenalty: 1.1,
      enableStreaming: true
    }
  );
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingThinking, setStreamingThinking] = useState<string>('');
  const [currentThinking, setCurrentThinking] = useState<string>('');

  // Rollback state management
  const [isRollbackConfirmationOpen, setIsRollbackConfirmationOpen] = useState(false);
  const [targetSegmentIndex, setTargetSegmentIndex] = useState<number | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);

  // Update sampler settings when aiConfig changes
  useEffect(() => {
    if (aiConfig?.samplerSettings) {
      setSamplerSettings(aiConfig.samplerSettings);
    }
  }, [aiConfig]);

  // Handler to save sampler settings to config
  const handleSamplerSettingsChange = useCallback((newSettings: SamplerSettings) => {
    setSamplerSettings(newSettings);

    // Save to config storage
    if (aiConfig) {
      const updatedConfig: AIConfig = {
        ...aiConfig,
        samplerSettings: newSettings
      };
      AIConfigStorage.saveConfig(updatedConfig);
    }
  }, [aiConfig]);

  const resumeGame = useCallback((savedGame: SavedGame) => {
    try {
      setGameState(savedGame.gameState);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume game';
      setError(errorMessage);
      console.error('Failed to resume game:', err);
    }
  }, []);

  // Initialize game manager
  useEffect(() => {
    if (gameToResume) {
      resumeGame(gameToResume);
    }
    setIsInitialized(true);
  }, [gameToResume, resumeGame]);

  // Auto-save game state when it changes
  useEffect(() => {
    if (!gameState || !isInitialized) return;

    // Validate game state before saving
    const validation = SaveManager.validateGameState(gameState);
    if (!validation.isValid) {
      console.warn('Invalid game state, skipping auto-save:', validation.errors);
      return;
    }

    // Schedule auto-save with debouncing
    SaveManager.scheduleAutoSave(gameState);

    // Cleanup function
    return () => {
      // Note: SaveManager handles its own cleanup
    };
  }, [gameState, isInitialized]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      SaveManager.cleanup();
    };
  }, []);

  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  const createStoryContext = useCallback((gameState: GameState): StoryContext => {
    // Include the current story in the history for context
    const contextStoryHistory = [...gameState.storyHistory, gameState.currentStory];
    return StoryService.createStoryContext(
      contextStoryHistory,
      gameState.choiceHistory,
      gameState.currentStory.sceneDescription
    );
  }, []);

  // Helper function to extract narrative text without choices for image generation
  const extractNarrativeText = useCallback((storyText: string): string => {
    // Remove choices section that typically starts with "Do you:" or similar patterns
    const choicePatterns = [
      'Do you:',
      'What do you do?',
      'Your options are:',
      'Choose your action:',
      'You can:',
      'Your choices:'
    ];

    for (const pattern of choicePatterns) {
      const index = storyText.indexOf(pattern);
      if (index !== -1) {
        return storyText.substring(0, index).trim();
      }
    }

    // If no choice pattern found, return the full text
    return storyText.trim();
  }, []);

  const generateImageForStory = useCallback(async (
    storySegment: StorySegment,
    storyContext?: string
  ): Promise<string | null> => {
    if (!aiConfig || aiConfig.enableImageGeneration === false) return null;

    try {
      setIsGeneratingImage(true);
      setImageError(null);

      const imageUrl = await ImageService.generateSceneImageWithRetry(
        aiConfig,
        storySegment.sceneDescription,
        storyContext
      );

      return imageUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate image';
      setImageError(errorMessage);
      console.warn('Image generation failed:', errorMessage);
      return null;
    } finally {
      setIsGeneratingImage(false);
    }
  }, [aiConfig]);

  const retryImageGeneration = useCallback(async () => {
    if (!gameState || !aiConfig) return;

    const storyContext = gameState.storyHistory.length > 0
      ? extractNarrativeText(gameState.storyHistory[gameState.storyHistory.length - 1].text)
      : undefined;

    const imageUrl = await generateImageForStory(gameState.currentStory, storyContext);

    if (imageUrl) {
      const updatedStory = { ...gameState.currentStory, imageUrl };
      setGameState({
        ...gameState,
        currentStory: updatedStory,
        lastUpdated: new Date()
      });
    }
  }, [gameState, aiConfig, generateImageForStory, extractNarrativeText]);

  const startNewGame = useCallback(async () => {
    if (!aiConfig) {
      onConfigurationNeeded();
      return;
    }

    setError(null);
    setLastFailedOperation(null);
    setImageError(null);
    setStreamingText('');
    setStreamingThinking('');
    setCurrentThinking('');

    const useStreaming = samplerSettings.enableStreaming ?? true;

    if (useStreaming) {
      setIsStreaming(true);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      setIsStreaming(false);
    }

    try {
      const initialStory = useStreaming
        ? await StoryService.generateInitialStoryStream(
          aiConfig,
          (chunk: string) => {
            setStreamingText(prev => prev + chunk);
          },
          samplerSettings,
          (thinkingChunk: string) => {
            setStreamingThinking(prev => prev + thinkingChunk);
          }
        )
        : await StoryService.generateInitialStory(aiConfig, samplerSettings);

      setIsStreaming(false);
      setIsLoading(false);

      const newGameState: GameState = {
        gameId: generateId(),
        currentStory: initialStory,
        storyHistory: [],
        choiceHistory: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
        gameMode: 'standard'
      };

      setGameState(newGameState);
      setStreamingText('');
      setCurrentThinking(initialStory.thinkingContent || '');
      setStreamingThinking('');

      // Perform immediate save for new game (critical save point)
      SaveManager.performImmediateSave(newGameState).catch(err => {
        console.warn('Failed to perform immediate save for new game:', err);
      });

      // Generate image for initial story (non-blocking)
      generateImageForStory(initialStory).then(imageUrl => {
        if (imageUrl) {
          setGameState(prevState => {
            if (!prevState || prevState.gameId !== newGameState.gameId) return prevState;
            const updatedState = {
              ...prevState,
              currentStory: { ...prevState.currentStory, imageUrl },
              lastUpdated: new Date()
            };

            // Auto-save the updated state with image
            SaveManager.scheduleAutoSave(updatedState);
            return updatedState;
          });
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start new game';
      setError(errorMessage);
      setLastFailedOperation({ type: 'initial' });
      setIsStreaming(false);
      setStreamingText('');
      setStreamingThinking('');
      setIsLoading(false);
    }
  }, [aiConfig, onConfigurationNeeded, generateImageForStory, samplerSettings]);

  const startCustomGame = useCallback(async (sceneDescription: string) => {
    if (!aiConfig) {
      onConfigurationNeeded();
      return;
    }

    setError(null);
    setLastFailedOperation(null);
    setImageError(null);
    setStreamingText('');
    setStreamingThinking('');
    setCurrentThinking('');

    const useStreaming = samplerSettings.enableStreaming ?? true;

    if (useStreaming) {
      setIsStreaming(true);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      setIsStreaming(false);
    }

    try {
      const initialStory = useStreaming
        ? await CustomStoryService.generateCustomInitialStoryStream(
          aiConfig,
          sceneDescription,
          (chunk: string) => {
            setStreamingText(prev => prev + chunk);
          },
          samplerSettings,
          (thinkingChunk: string) => {
            setStreamingThinking(prev => prev + thinkingChunk);
          }
        )
        : await CustomStoryService.generateCustomInitialStory(aiConfig, sceneDescription, samplerSettings);

      setIsStreaming(false);
      setIsLoading(false);

      const newGameState: GameState = {
        gameId: generateId(),
        currentStory: initialStory,
        storyHistory: [],
        choiceHistory: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
        gameMode: 'custom',
        customScene: sceneDescription
      };

      setGameState(newGameState);
      setStreamingText('');
      setCurrentThinking(initialStory.thinkingContent || '');
      setStreamingThinking('');

      // Perform immediate save for new game (critical save point)
      SaveManager.performImmediateSave(newGameState).catch(err => {
        console.warn('Failed to perform immediate save for new game:', err);
      });

      // Generate image for initial story (non-blocking)
      generateImageForStory(initialStory).then(imageUrl => {
        if (imageUrl) {
          setGameState(prevState => {
            if (!prevState || prevState.gameId !== newGameState.gameId) return prevState;
            const updatedState = {
              ...prevState,
              currentStory: { ...prevState.currentStory, imageUrl },
              lastUpdated: new Date()
            };

            // Auto-save the updated state with image
            SaveManager.scheduleAutoSave(updatedState);
            return updatedState;
          });
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start custom game';
      setError(errorMessage);
      setLastFailedOperation({ type: 'custom-initial', data: sceneDescription });
      setIsStreaming(false);
      setStreamingText('');
      setStreamingThinking('');
      setIsLoading(false);
    }
  }, [aiConfig, onConfigurationNeeded, generateImageForStory, samplerSettings]);

  const handleChoiceSelect = useCallback(async (choice: Choice) => {
    if (!gameState || !aiConfig) {
      onConfigurationNeeded();
      return;
    }

    setError(null);
    setLastFailedOperation(null);
    setImageError(null);
    setStreamingText('');
    setStreamingThinking('');
    setCurrentThinking('');

    const useStreaming = samplerSettings.enableStreaming ?? true;

    if (useStreaming) {
      setIsStreaming(true);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      setIsStreaming(false);
    }

    try {
      // Create story context for continuation
      const context = createStoryContext(gameState);

      // Generate next story segment with or without streaming
      const nextStory = useStreaming
        ? await StoryService.continueStoryStream(
          aiConfig,
          choice,
          context,
          (chunk: string) => {
            setStreamingText(prev => prev + chunk);
          },
          samplerSettings,
          (thinkingChunk: string) => {
            setStreamingThinking(prev => prev + thinkingChunk);
          }
        )
        : await StoryService.continueStory(aiConfig, choice, context, samplerSettings);

      setIsStreaming(false);
      setIsLoading(false);

      // Update game state
      const updatedGameState: GameState = {
        ...gameState,
        currentStory: nextStory,
        storyHistory: [...gameState.storyHistory, gameState.currentStory],
        choiceHistory: [...gameState.choiceHistory, { ...choice, selected: true }],
        lastUpdated: new Date()
      };

      setGameState(updatedGameState);
      setStreamingText('');
      setCurrentThinking(nextStory.thinkingContent || '');
      setStreamingThinking('');

      // Perform immediate save at choice points (critical save point)
      SaveManager.performImmediateSave(updatedGameState).catch(err => {
        console.warn('Failed to perform immediate save after choice:', err);
      });

      // Generate image for new story segment (non-blocking)
      // Use only the narrative part without choices for image context
      const storyContext = extractNarrativeText(nextStory.text);
      generateImageForStory(nextStory, storyContext).then(imageUrl => {
        if (imageUrl) {
          setGameState(prevState => {
            if (!prevState || prevState.gameId !== updatedGameState.gameId) return prevState;
            return {
              ...prevState,
              currentStory: { ...prevState.currentStory, imageUrl },
              lastUpdated: new Date()
            };
          });
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to continue story';
      setError(errorMessage);
      setLastFailedOperation({ type: 'choice', data: choice });
      setIsStreaming(false);
      setStreamingText('');
      setStreamingThinking('');
      setIsLoading(false);
    }
  }, [gameState, aiConfig, onConfigurationNeeded, createStoryContext, generateImageForStory, extractNarrativeText, samplerSettings]);

  const handleCustomActionSubmit = useCallback(async (actionText: string) => {
    if (!gameState || !aiConfig) {
      onConfigurationNeeded();
      return;
    }

    setError(null);
    setLastFailedOperation(null);
    setImageError(null);
    setStreamingText('');
    setStreamingThinking('');
    setCurrentThinking('');

    const useStreaming = samplerSettings.enableStreaming ?? true;

    if (useStreaming) {
      setIsStreaming(true);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      setIsStreaming(false);
    }

    try {
      // Convert custom action text to Choice object with isCustom flag
      const customChoice: Choice = {
        id: generateId(),
        text: actionText,
        selected: true,
        isCustom: true
      };

      // Create story context for continuation
      // Include the current story in the history for context
      const contextStoryHistory = [...gameState.storyHistory, gameState.currentStory];
      const context = CustomStoryService.createStoryContext(
        contextStoryHistory,
        gameState.choiceHistory,
        gameState.currentStory.sceneDescription
      );

      // Generate next story segment using CustomStoryService
      const nextStory = useStreaming
        ? await CustomStoryService.continueCustomStoryStream(
          aiConfig,
          actionText,
          context,
          (chunk: string) => {
            setStreamingText(prev => prev + chunk);
          },
          samplerSettings,
          (thinkingChunk: string) => {
            setStreamingThinking(prev => prev + thinkingChunk);
          }
        )
        : await CustomStoryService.continueCustomStory(aiConfig, actionText, context, samplerSettings);

      setIsStreaming(false);
      setIsLoading(false);

      // Update game state
      const updatedGameState: GameState = {
        ...gameState,
        currentStory: nextStory,
        storyHistory: [...gameState.storyHistory, gameState.currentStory],
        choiceHistory: [...gameState.choiceHistory, customChoice],
        lastUpdated: new Date()
      };

      setGameState(updatedGameState);
      setStreamingText('');
      setCurrentThinking(nextStory.thinkingContent || '');
      setStreamingThinking('');

      // Perform immediate save at choice points (critical save point)
      SaveManager.performImmediateSave(updatedGameState).catch(err => {
        console.warn('Failed to perform immediate save after custom action:', err);
      });

      // Generate image for new story segment (non-blocking)
      const storyContext = extractNarrativeText(nextStory.text);
      generateImageForStory(nextStory, storyContext).then(imageUrl => {
        if (imageUrl) {
          setGameState(prevState => {
            if (!prevState || prevState.gameId !== updatedGameState.gameId) return prevState;
            return {
              ...prevState,
              currentStory: { ...prevState.currentStory, imageUrl },
              lastUpdated: new Date()
            };
          });
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to continue custom story';
      setError(errorMessage);
      setLastFailedOperation({ type: 'custom-action', data: actionText });
      setIsStreaming(false);
      setStreamingText('');
      setStreamingThinking('');
      setIsLoading(false);
    }
  }, [gameState, aiConfig, onConfigurationNeeded, generateImageForStory, extractNarrativeText, samplerSettings]);

  const handleRetry = useCallback(() => {
    // Use the last failed operation to determine what to retry
    if (lastFailedOperation) {
      switch (lastFailedOperation.type) {
        case 'initial':
          startNewGame();
          break;
        case 'custom-initial':
          if (typeof lastFailedOperation.data === 'string') {
            startCustomGame(lastFailedOperation.data);
          }
          break;
        case 'choice':
          if (lastFailedOperation.data && typeof lastFailedOperation.data === 'object') {
            handleChoiceSelect(lastFailedOperation.data as Choice);
          }
          break;
        case 'custom-action':
          if (typeof lastFailedOperation.data === 'string') {
            handleCustomActionSubmit(lastFailedOperation.data);
          }
          break;
      }
    } else if (gameState) {
      // Fallback to old logic if no failed operation is tracked
      const lastChoice = gameState.choiceHistory[gameState.choiceHistory.length - 1];
      if (lastChoice) {
        handleChoiceSelect(lastChoice);
      } else {
        if (gameState.gameMode === 'custom' && gameState.customScene) {
          startCustomGame(gameState.customScene);
        } else {
          startNewGame();
        }
      }
    } else {
      // No game state, check props to determine what type of game to retry
      if (gameMode === 'custom' && customScene) {
        startCustomGame(customScene);
      } else {
        startNewGame();
      }
    }
  }, [lastFailedOperation, gameState, handleChoiceSelect, startNewGame, startCustomGame, handleCustomActionSubmit, gameMode, customScene]);

  const handleRegenerate = useCallback(async () => {
    if (!gameState || !aiConfig) {
      onConfigurationNeeded();
      return;
    }

    setError(null);
    setImageError(null);
    setStreamingText('');
    setStreamingThinking('');
    setCurrentThinking('');

    const useStreaming = samplerSettings.enableStreaming ?? true;

    if (useStreaming) {
      setIsStreaming(true);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      setIsStreaming(false);
    }

    try {
      let regeneratedStory: StorySegment;

      if (gameState.choiceHistory.length === 0) {
        // Regenerate initial story
        if (gameState.gameMode === 'custom' && gameState.customScene) {
          regeneratedStory = useStreaming
            ? await CustomStoryService.regenerateCustomInitialStoryStream(
              aiConfig,
              gameState.customScene,
              (chunk: string) => {
                setStreamingText(prev => prev + chunk);
              },
              samplerSettings,
              (thinkingChunk: string) => {
                setStreamingThinking(prev => prev + thinkingChunk);
              }
            )
            : await CustomStoryService.regenerateCustomInitialStory(aiConfig, gameState.customScene, samplerSettings);
        } else {
          regeneratedStory = useStreaming
            ? await StoryService.regenerateInitialStoryStream(
              aiConfig,
              (chunk: string) => {
                setStreamingText(prev => prev + chunk);
              },
              samplerSettings,
              (thinkingChunk: string) => {
                setStreamingThinking(prev => prev + thinkingChunk);
              }
            )
            : await StoryService.regenerateInitialStory(aiConfig, samplerSettings);
        }
      } else {
        // Regenerate continuation based on last choice
        const lastChoice = gameState.choiceHistory[gameState.choiceHistory.length - 1];
        const context = createStoryContext(gameState);

        if (gameState.gameMode === 'custom' && lastChoice.isCustom) {
          regeneratedStory = useStreaming
            ? await CustomStoryService.regenerateCustomStoryStream(
              aiConfig,
              lastChoice.text,
              context,
              (chunk: string) => {
                setStreamingText(prev => prev + chunk);
              },
              samplerSettings,
              (thinkingChunk: string) => {
                setStreamingThinking(prev => prev + thinkingChunk);
              }
            )
            : await CustomStoryService.regenerateCustomStory(aiConfig, lastChoice.text, context, samplerSettings);
        } else {
          regeneratedStory = useStreaming
            ? await StoryService.regenerateStoryStream(
              aiConfig,
              lastChoice,
              context,
              (chunk: string) => {
                setStreamingText(prev => prev + chunk);
              },
              samplerSettings,
              (thinkingChunk: string) => {
                setStreamingThinking(prev => prev + thinkingChunk);
              }
            )
            : await StoryService.regenerateStory(aiConfig, lastChoice, context, samplerSettings);
        }
      }

      setIsStreaming(false);
      setIsLoading(false);

      // Update game state with regenerated story
      const updatedGameState: GameState = {
        ...gameState,
        currentStory: regeneratedStory,
        lastUpdated: new Date()
      };

      setGameState(updatedGameState);
      setStreamingText('');
      setCurrentThinking(regeneratedStory.thinkingContent || '');
      setStreamingThinking('');

      // Perform immediate save after regeneration
      SaveManager.performImmediateSave(updatedGameState).catch(err => {
        console.warn('Failed to perform immediate save after regeneration:', err);
      });

      // Generate image for regenerated story (non-blocking)
      const storyContext = extractNarrativeText(regeneratedStory.text);
      generateImageForStory(regeneratedStory, storyContext).then(imageUrl => {
        if (imageUrl) {
          setGameState(prevState => {
            if (!prevState || prevState.gameId !== updatedGameState.gameId) return prevState;
            return {
              ...prevState,
              currentStory: { ...prevState.currentStory, imageUrl },
              lastUpdated: new Date()
            };
          });
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to regenerate story';
      setError(errorMessage);
      setIsStreaming(false);
      setStreamingText('');
      setStreamingThinking('');
      setIsLoading(false);
    }
  }, [gameState, aiConfig, onConfigurationNeeded, createStoryContext, generateImageForStory, extractNarrativeText, samplerSettings]);

  const resetGame = useCallback(() => {
    // Use the specific new game handler if available, otherwise fall back to launcher
    if (onNewGame) {
      onNewGame();
    } else if (onBackToLauncher) {
      onBackToLauncher();
    } else {
      // Fallback: just clear the game state
      setGameState(null);
      setError(null);
      setIsLoading(false);
    }
  }, [onNewGame, onBackToLauncher]);

  // Enhanced rollback validation
  const validateRollbackOperation = useCallback((segmentIndex: number, gameState: GameState) => {
    const errors: string[] = [];

    // Basic bounds checking
    if (segmentIndex < 0) {
      errors.push('Segment index cannot be negative');
    }

    if (segmentIndex >= gameState.storyHistory.length) {
      errors.push('Segment index exceeds story history length');
    }

    // State validation
    if (!gameState.storyHistory || gameState.storyHistory.length === 0) {
      errors.push('No story history available for rollback');
    }

    if (!gameState.choiceHistory) {
      errors.push('Choice history is missing');
    }

    // Data integrity checks
    if (gameState.storyHistory && gameState.choiceHistory) {
      // For rollback to work, we need at least segmentIndex choices
      // (since we'll keep segmentIndex choices and delete the rest)
      const expectedChoiceCount = segmentIndex;
      if (gameState.choiceHistory.length < expectedChoiceCount) {
        errors.push('Insufficient choice history for rollback operation');
      }

      // Validate that the target segment exists and has required properties
      const targetSegment = gameState.storyHistory[segmentIndex];
      if (!targetSegment) {
        errors.push('Target segment does not exist');
      } else {
        if (!targetSegment.id) {
          errors.push('Target segment is missing required ID');
        }
        if (!targetSegment.text) {
          errors.push('Target segment is missing story text');
        }
        if (!targetSegment.sceneDescription) {
          errors.push('Target segment is missing scene description');
        }
      }
    }

    // Game state integrity checks
    if (!gameState.gameId) {
      errors.push('Game state is missing game ID');
    }

    if (!gameState.currentStory) {
      errors.push('Game state is missing current story');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  // Rollback calculation logic with enhanced validation
  const calculateRollbackOperation = useCallback((segmentIndex: number, gameState: GameState) => {
    // Perform comprehensive validation
    const validation = validateRollbackOperation(segmentIndex, gameState);
    if (!validation.isValid) {
      throw new Error(`Rollback validation failed: ${validation.errors.join(', ')}`);
    }

    // Get the target segment that will become the new current story
    const targetSegment = gameState.storyHistory[segmentIndex];
    if (!targetSegment) {
      throw new Error('Target segment does not exist');
    }

    // Calculate what will be deleted
    // Everything after the target segment index will be deleted from history, plus the current segment
    const segmentsToDelete = (gameState.storyHistory.length - segmentIndex - 1) + 1; // +1 for current segment
    const choicesToDelete = gameState.choiceHistory.length - segmentIndex;

    // Additional safety checks
    if (segmentsToDelete < 0) {
      throw new Error('Invalid rollback: target segment is beyond history');
    }

    if (choicesToDelete < 0) {
      throw new Error('Data integrity error: insufficient choice history for rollback');
    }

    // Create new game state with truncated history
    // Keep everything up to (but not including) the target segment
    const newStoryHistory = gameState.storyHistory.slice(0, segmentIndex);
    const newChoiceHistory = gameState.choiceHistory.slice(0, segmentIndex);

    // The target segment becomes the new current story
    const newCurrentStory = targetSegment;

    const newGameState: GameState = {
      ...gameState,
      currentStory: newCurrentStory,
      storyHistory: newStoryHistory,
      choiceHistory: newChoiceHistory,
      lastUpdated: new Date()
    };

    // Final validation of the new game state
    if (!newGameState.gameId || !newGameState.currentStory) {
      throw new Error('Failed to create valid rollback state: missing required properties');
    }

    return {
      targetSegmentIndex: segmentIndex,
      segmentsToDelete,
      choicesToDelete,
      newGameState
    };
  }, [validateRollbackOperation]);

  // Rollback handlers
  const handleRollbackRequest = useCallback((segmentIndex: number) => {
    // Clear any previous rollback errors
    setRollbackError(null);

    // Validate the rollback request before opening confirmation dialog
    if (!gameState) {
      setRollbackError('No game state available for rollback');
      return;
    }

    const validation = validateRollbackOperation(segmentIndex, gameState);
    if (!validation.isValid) {
      setRollbackError(`Cannot rollback: ${validation.errors.join(', ')}`);
      return;
    }

    setTargetSegmentIndex(segmentIndex);
    setIsRollbackConfirmationOpen(true);
  }, [gameState, validateRollbackOperation]);

  const handleRollbackConfirm = useCallback(async () => {
    if (targetSegmentIndex !== null && gameState) {
      try {
        // Clear any previous rollback errors
        setRollbackError(null);

        // Perform final validation before rollback
        const validation = validateRollbackOperation(targetSegmentIndex, gameState);
        if (!validation.isValid) {
          throw new Error(`Rollback validation failed: ${validation.errors.join(', ')}`);
        }

        // Calculate rollback operation
        const rollbackOperation = calculateRollbackOperation(targetSegmentIndex, gameState);

        // Validate the rollback operation result
        if (!rollbackOperation.newGameState) {
          throw new Error('Failed to calculate valid rollback state');
        }

        // Additional safety check: ensure we're not in an invalid state
        if (isLoading || isStreaming) {
          throw new Error('Cannot perform rollback while other operations are in progress');
        }

        // Update game state with truncated history
        setGameState(rollbackOperation.newGameState);

        // Clear any loading or error states appropriately
        setError(null);
        setImageError(null);
        setLastFailedOperation(null);
        setIsLoading(false);
        setIsStreaming(false);
        setIsGeneratingImage(false);
        setStreamingText('');
        setStreamingThinking('');

        // Trigger immediate save after rollback with error handling
        try {
          await SaveManager.performImmediateSave(rollbackOperation.newGameState);
        } catch (saveErr) {
          console.error('Failed to save after rollback:', saveErr);
          // Don't fail the rollback operation due to save failure, but warn the user
          setRollbackError('Rollback completed but failed to save. Your progress may not be preserved.');
        }

        // Close confirmation dialog
        setIsRollbackConfirmationOpen(false);
        setTargetSegmentIndex(null);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to perform rollback';
        setRollbackError(errorMessage);
        console.error('Rollback failed:', err);

        // Don't close dialog on error so user can see the error and try again or cancel
        // setIsRollbackConfirmationOpen(false);
        // setTargetSegmentIndex(null);
      }
    } else {
      // Handle invalid state
      const errorMessage = !gameState ? 'No game state available' : 'No target segment selected';
      setRollbackError(errorMessage);
      console.error('Rollback failed: Invalid state -', { targetSegmentIndex, hasGameState: !!gameState });
    }
  }, [targetSegmentIndex, gameState, calculateRollbackOperation, validateRollbackOperation, isLoading, isStreaming]);

  const handleRollbackCancel = useCallback(() => {
    setIsRollbackConfirmationOpen(false);
    setTargetSegmentIndex(null);
    setRollbackError(null); // Clear rollback errors when canceling
  }, []);

  // Handle custom game initialization when props are provided
  useEffect(() => {
    if (gameMode === 'custom' && customScene && !gameState && isInitialized && !gameToResume) {
      startCustomGame(customScene);
    } else if (gameMode === 'standard' && !gameState && isInitialized && !gameToResume) {
      startNewGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, customScene, gameState, isInitialized, gameToResume]);

  // Show configuration needed state
  if (!aiConfig) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-4">
            <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Configuration Required</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Please configure your AI settings before starting a new adventure.
          </p>
          <button
            onClick={onConfigurationNeeded}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
          >
            Configure AI Settings
          </button>
        </div>
      </div>
    );
  }

  // Show initial state (no game started)
  if (!gameState && !isLoading && !isStreaming && !error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center relative">
          {/* Sampler Settings Button - Top Right */}
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setShowSamplerSettings(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Adjust sampler settings"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              AI Sampler
            </button>
          </div>

          {/* Sampler Settings Modal */}
          {showSamplerSettings && (
            <SamplerSettingsModal
              settings={samplerSettings}
              onSettingsChange={handleSamplerSettingsChange}
              onClose={() => setShowSamplerSettings(false)}
            />
          )}

          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6">
            <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Ready for Adventure</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Start a new Choose Your Own Adventure story powered by AI.
            Your choices will shape the narrative as it unfolds.
          </p>
          <div className="space-y-4">
            <button
              onClick={startNewGame}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
            >
              <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start New Adventure
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6">
      {/* Game Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Your Adventure</h1>
          {gameState && (
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Choices made: {gameState.choiceHistory.length}
            </span>
          )}
        </div>
        <div className="flex space-x-2 w-full sm:w-auto">
          <button
            onClick={resetGame}
            className="inline-flex items-center justify-center flex-1 sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-xs sm:text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
          >
            <svg className="mr-1 sm:mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            New Game
          </button>
        </div>
      </div>

      {/* Story Display */}
      <StoryDisplay
        currentStory={gameState?.currentStory || null}
        storyHistory={gameState?.storyHistory || []}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        onRegenerate={handleRegenerate}
        canRegenerate={!!gameState && !isLoading && !isStreaming}
        isGeneratingImage={isGeneratingImage}
        imageError={imageError}
        onImageRetry={retryImageGeneration}
        samplerSettings={samplerSettings}
        onSamplerSettingsChange={handleSamplerSettingsChange}
        streamingText={streamingText}
        isStreaming={isStreaming}
        enableImageGeneration={aiConfig?.enableImageGeneration ?? true}
        thinkingContent={currentThinking}
        streamingThinking={streamingThinking}
        onRollback={handleRollbackRequest}
      />

      {/* Rollback Error Display */}
      {rollbackError && !isRollbackConfirmationOpen && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Rollback Failed
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {rollbackError}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setRollbackError(null)}
                className="inline-flex text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 transition-colors"
                aria-label="Dismiss error"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Choice Panel or Custom Action Panel based on game mode */}
      {gameState && !error && (
        gameState.gameMode === 'custom' ? (
          <CustomActionPanel
            isLoading={isLoading || isStreaming}
            disabled={isLoading || isStreaming}
            onActionSubmit={handleCustomActionSubmit}
            choiceHistory={gameState.choiceHistory}
          />
        ) : (
          <ChoicePanel
            choices={gameState.currentStory.choices}
            choiceHistory={gameState.choiceHistory}
            isLoading={isLoading || isStreaming}
            onChoiceSelect={handleChoiceSelect}
          />
        )
      )}

      {/* Rollback Confirmation Dialog */}
      {gameState && (
        <RollbackConfirmationDialog
          isOpen={isRollbackConfirmationOpen}
          onClose={handleRollbackCancel}
          onConfirm={handleRollbackConfirm}
          segmentIndex={targetSegmentIndex || 0}
          segmentCount={gameState.storyHistory.length}
          choiceCount={gameState.choiceHistory.length}
          error={rollbackError}
        />
      )}
    </div>
  );
};

export default GameManager;