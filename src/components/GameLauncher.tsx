import React, { useState, useEffect, useCallback } from 'react';
import { SavedGamesList } from './SavedGamesList';
import { SamplerSettings } from './SamplerSettings';
import { ModeSelector } from './ModeSelector';
import { CustomSceneInput } from './CustomSceneInput';
import { SavedGamesStorage, AIConfigStorage } from '../utils/storage';
import type { SavedGame, AIConfig, SamplerSettings as SamplerSettingsType, GameMode } from '../types';

interface GameLauncherProps {
  aiConfig: AIConfig | null;
  onConfigurationNeeded: () => void;
  onStartNewGame: (gameMode?: GameMode, customScene?: string) => void;
  onResumeGame: (game: SavedGame) => void;
  startWithModeSelection?: boolean;
  startWithSavedGames?: boolean;
}

/**
 * GameLauncher component manages the initial game selection flow,
 * allowing users to choose between starting a new game or resuming an existing one.
 * 
 * Requirements addressed:
 * - 5.2: Offer to resume the most recent adventure
 * - 5.4: Provide option to begin a new adventure
 */
export const GameLauncher: React.FC<GameLauncherProps> = ({
  aiConfig,
  onConfigurationNeeded,
  onStartNewGame,
  onResumeGame,
  startWithModeSelection = false,
  startWithSavedGames = false
}) => {
  const [view, setView] = useState<'welcome' | 'saved-games'>('welcome');
  const [mostRecentGame, setMostRecentGame] = useState<SavedGame | null>(null);
  const [hasGames, setHasGames] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSamplerSettings, setShowSamplerSettings] = useState(false);
  const [samplerSettings, setSamplerSettings] = useState<SamplerSettingsType>(
    aiConfig?.samplerSettings || {
      temperature: 0.7,
      minP: 0.05,
      repetitionPenalty: 1.1
    }
  );
  const [launcherStep, setLauncherStep] = useState<'welcome' | 'mode-select' | 'custom-scene'>('welcome');

  useEffect(() => {
    checkForSavedGames();
  }, []);

  // Update sampler settings when aiConfig changes
  useEffect(() => {
    if (aiConfig?.samplerSettings) {
      setSamplerSettings(aiConfig.samplerSettings);
    }
  }, [aiConfig]);

  // If startWithModeSelection is true, go directly to mode selection
  // If it's false, reset to welcome screen
  useEffect(() => {
    if (startWithModeSelection) {
      setLauncherStep('mode-select');
    } else {
      // Reset to welcome screen when startWithModeSelection becomes false
      setLauncherStep('welcome');
      setView('welcome');
    }
  }, [startWithModeSelection]);

  // If startWithSavedGames is true, go directly to saved games view
  useEffect(() => {
    if (startWithSavedGames) {
      setLauncherStep('welcome');
      setView('saved-games');
    }
  }, [startWithSavedGames]);

  // Handler to save sampler settings to config
  const handleSamplerSettingsChange = useCallback((newSettings: SamplerSettingsType) => {
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

  const checkForSavedGames = () => {
    try {
      setIsLoading(true);
      const gameCount = SavedGamesStorage.getGameCount();
      const recentGame = SavedGamesStorage.getMostRecentGame();

      setHasGames(gameCount > 0);
      setMostRecentGame(recentGame);

      // If there are saved games, show the welcome screen with resume option
      // Otherwise, show the new game option
      setView('welcome');
    } catch (error) {
      console.error('Failed to check for saved games:', error);
      setHasGames(false);
      setMostRecentGame(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshGamesList = () => {
    try {
      const gameCount = SavedGamesStorage.getGameCount();
      const recentGame = SavedGamesStorage.getMostRecentGame();

      setHasGames(gameCount > 0);
      setMostRecentGame(recentGame);

      // Don't change the view - stay on current page
    } catch (error) {
      console.error('Failed to refresh saved games:', error);
      setHasGames(false);
      setMostRecentGame(null);
    }
  };

  const handleViewSavedGames = () => {
    setView('saved-games');
  };

  const handleBackToWelcome = () => {
    setView('welcome');
    setLauncherStep('welcome');
    refreshGamesList(); // Refresh the game list without changing view
  };

  const handleDeleteGame = (gameId: string) => {
    // The actual deletion is handled by SavedGamesList
    // This callback is called after deletion to refresh the game list
    console.log(`Game ${gameId} deleted, refreshing list`);
    refreshGamesList();
  };

  const handleStartNewAdventure = () => {
    setView('welcome'); // Reset view to welcome so launcherStep logic takes over
    setLauncherStep('mode-select');
  };

  const handleModeSelect = (selectedMode: GameMode) => {
    if (selectedMode === 'custom') {
      setLauncherStep('custom-scene');
    } else {
      // Standard mode - start game immediately
      onStartNewGame('standard');
    }
  };

  const handleCustomSceneSubmit = (sceneDescription: string) => {
    onStartNewGame('custom', sceneDescription);
  };

  const handleBackFromCustomScene = () => {
    setLauncherStep('mode-select');
  };

  const handleBackFromModeSelect = () => {
    setLauncherStep('welcome');
  };



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
            Please configure your AI settings before starting or resuming an adventure.
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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="animate-pulse text-center">
            <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto mb-8"></div>
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show saved games list view
  if (view === 'saved-games') {
    return (
      <>
        <div className="max-w-4xl mx-auto p-6 mb-4">
          <button
            onClick={handleBackToWelcome}
            className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Welcome
          </button>
        </div>
        <SavedGamesList
          onResumeGame={onResumeGame}
          onDeleteGame={handleDeleteGame}
          onNewGame={handleStartNewAdventure}
        />
      </>
    );
  }

  // Show mode selection step
  if (launcherStep === 'mode-select') {
    return (
      <>
        <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-6 mb-4">
          <button
            onClick={handleBackFromModeSelect}
            className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <ModeSelector
          onModeSelect={handleModeSelect}
          aiConfig={aiConfig}
          samplerSettings={samplerSettings}
          onSamplerSettingsChange={handleSamplerSettingsChange}
        />
      </>
    );
  }

  // Show custom scene input step
  if (launcherStep === 'custom-scene') {
    return (
      <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
        <CustomSceneInput
          onSceneSubmit={handleCustomSceneSubmit}
          onBack={handleBackFromCustomScene}
          aiConfig={aiConfig}
          samplerSettings={samplerSettings}
          onSamplerSettingsChange={handleSamplerSettingsChange}
        />
      </div>
    );
  }

  // Show welcome screen with game options
  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8 text-center relative">
        {/* Sampler Settings Button - Top Right */}
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
          <button
            onClick={() => setShowSamplerSettings(true)}
            className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            title="Adjust sampler settings"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="hidden sm:inline">AI Sampler</span>
          </button>
        </div>

        {/* Sampler Settings Modal */}
        {showSamplerSettings && (
          <SamplerSettings
            settings={samplerSettings}
            onSettingsChange={handleSamplerSettingsChange}
            onClose={() => setShowSamplerSettings(false)}
          />
        )}

        <div className="mx-auto flex items-center justify-center h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4 sm:mb-6 mt-6 sm:mt-0">
          <svg className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
          Welcome to AI Adventure
        </h2>

        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 px-2">
          Experience interactive storytelling powered by AI. Your choices shape the narrative as it unfolds.
        </p>

        {/* Resume most recent game option */}
        {hasGames && mostRecentGame && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base sm:text-lg font-medium text-green-900 dark:text-green-300">Continue Your Adventure</h3>
              {mostRecentGame.metadata.gameMode && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${mostRecentGame.metadata.gameMode === 'custom'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                  }`}>
                  {mostRecentGame.metadata.gameMode === 'custom' ? '✨ Custom' : '📖 Standard'}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-green-700 dark:text-green-400 mb-3 sm:mb-4">
              Resume "{mostRecentGame.metadata.title}" - {mostRecentGame.metadata.choiceCount} choices made
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-md p-2 sm:p-3 mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 line-clamp-2 break-words">
                {mostRecentGame.gameState.currentStory.text.substring(0, 150)}
                {mostRecentGame.gameState.currentStory.text.length > 150 ? '...' : ''}
              </p>
            </div>
            <button
              onClick={() => onResumeGame(mostRecentGame)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 border border-transparent text-sm sm:text-base font-medium rounded-md shadow-sm text-white bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-green-400 transition-colors"
            >
              <svg className="mr-2 h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Resume Adventure
            </button>
          </div>
        )}

        {/* Action buttons with consistent styling */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-center">
          {/* Start New Adventure button */}
          <button
            onClick={handleStartNewAdventure}
            className="w-full sm:w-64 h-14 inline-flex items-center justify-center px-6 py-4 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
          >
            <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Start New Adventure
          </button>

          {/* View All Saved Games button */}
          {hasGames && (
            <button
              onClick={handleViewSavedGames}
              className="w-full sm:w-64 h-14 inline-flex items-center justify-center px-6 py-4 border border-gray-300 dark:border-gray-600 shadow-sm text-base font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
            >
              <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              View All Saved Games ({SavedGamesStorage.getGameCount()})
            </button>
          )}
        </div>

        {/* First time user message */}
        {!hasGames && (
          <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
              🎉 This is your first adventure! Your progress will be automatically saved as you play.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameLauncher;