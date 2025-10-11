import React, { useState, useEffect } from 'react';
import { SavedGamesStorage } from '../utils/storage';
import type { SavedGame } from '../types';

interface SavedGamesListProps {
  onResumeGame: (game: SavedGame) => void;
  onDeleteGame?: (gameId: string) => void;
  onNewGame: () => void;
}

/**
 * SavedGamesList component displays saved games with metadata and provides
 * resume/delete functionality for game management.
 * 
 * Requirements addressed:
 * - 5.2: Offer to resume the most recent adventure
 * - 5.3: Restore complete story context and current choice options
 * - 5.4: Provide option to begin a new adventure
 */
export const SavedGamesList: React.FC<SavedGamesListProps> = ({
  onResumeGame,
  onDeleteGame,
  onNewGame
}) => {
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Load saved games on component mount
  useEffect(() => {
    loadSavedGames();
  }, []);

  const loadSavedGames = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const games = SavedGamesStorage.loadAllGames();
      setSavedGames(games);

      // Validate storage integrity
      const validation = SavedGamesStorage.validateAndRepairStorage();
      if (!validation.isValid && validation.errors.length > 0) {
        console.warn('Storage validation issues:', validation.errors);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load saved games';
      setError(errorMessage);
      console.error('Failed to load saved games:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      setDeletingGameId(gameId);
      SavedGamesStorage.deleteGame(gameId);
      setSavedGames(prev => prev.filter(game => game.gameId !== gameId));

      // Call the parent callback if provided
      if (onDeleteGame) {
        onDeleteGame(gameId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete game';
      setError(errorMessage);
      console.error('Failed to delete game:', err);
    } finally {
      setDeletingGameId(null);
    }
  };

  const handleToggleSelection = (gameId: string) => {
    setSelectedGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gameId)) {
        newSet.delete(gameId);
      } else {
        newSet.add(gameId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedGames.size === savedGames.length) {
      setSelectedGames(new Set());
    } else {
      setSelectedGames(new Set(savedGames.map(game => game.gameId)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedGames.size === 0) return;

    try {
      setIsBulkDeleting(true);

      // Delete all selected games
      for (const gameId of selectedGames) {
        SavedGamesStorage.deleteGame(gameId);
        if (onDeleteGame) {
          onDeleteGame(gameId);
        }
      }

      // Update the games list
      setSavedGames(prev => prev.filter(game => !selectedGames.has(game.gameId)));

      // Reset selection state
      setSelectedGames(new Set());
      setIsSelectionMode(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete selected games';
      setError(errorMessage);
      console.error('Failed to bulk delete games:', err);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleCancelSelection = () => {
    setSelectedGames(new Set());
    setIsSelectionMode(false);
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return formatDate(date);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
          <div className="animate-pulse">
            <div className="h-6 sm:h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 sm:w-1/3 mb-4 sm:mb-6"></div>
            <div className="space-y-3 sm:space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="h-5 sm:h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 sm:w-1/2 mb-2"></div>
                  <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 sm:w-1/4 mb-2"></div>
                  <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 sm:w-1/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Error Loading Games</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-center">
              <button
                onClick={loadSavedGames}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onNewGame}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
              >
                Start New Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Your Adventures</h2>
              {savedGames.length > 1 && !isSelectionMode && (
                <button
                  onClick={() => setIsSelectionMode(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                >
                  <svg className="mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">Select Multiple</span>
                  <span className="sm:hidden">Select</span>
                </button>
              )}
            </div>

            {!isSelectionMode && (
              <button
                onClick={onNewGame}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
              >
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Adventure
              </button>
            )}
          </div>

          {isSelectionMode && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                {selectedGames.size} of {savedGames.length} selected
              </span>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={handleSelectAll}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                >
                  {selectedGames.size === savedGames.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedGames.size === 0 || isBulkDeleting}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkDeleting ? (
                    <>
                      <svg className="mr-1.5 h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="hidden sm:inline">Deleting...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <svg className="mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete ({selectedGames.size})
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelSelection}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {savedGames.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-6">
              <svg className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Saved Adventures</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Start your first Choose Your Own Adventure story to begin your journey.
            </p>
            <button
              onClick={onNewGame}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
            >
              <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start Your First Adventure
            </button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {savedGames.map((game) => (
              <div
                key={game.gameId}
                className={`border rounded-lg p-4 sm:p-6 transition-colors ${isSelectionMode && selectedGames.has(game.gameId)
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
              >
                <div className="flex flex-col space-y-4">
                  {/* Header with title and checkbox */}
                  <div className="flex items-start gap-3">
                    {isSelectionMode && (
                      <div className="flex items-center pt-1">
                        <input
                          type="checkbox"
                          checked={selectedGames.has(game.gameId)}
                          onChange={() => handleToggleSelection(game.gameId)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
                          {game.metadata.title}
                        </h3>
                        {game.metadata.gameMode && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium self-start ${game.metadata.gameMode === 'custom'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                            }`}>
                            {game.metadata.gameMode === 'custom' ? '✨ Custom' : '📖 Standard'}
                          </span>
                        )}
                      </div>

                      {/* Game metadata - responsive grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <div>
                          <span className="font-medium">Choices:</span> {game.metadata.choiceCount}
                        </div>
                        <div>
                          <span className="font-medium">Last played:</span> {formatRelativeTime(game.metadata.lastPlayed)}
                        </div>
                        <div className="hidden sm:block">
                          <span className="font-medium">Created:</span> {formatDate(game.metadata.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Story preview */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 sm:line-clamp-3">
                      {game.gameState.currentStory.text.substring(0, 150)}
                      {game.gameState.currentStory.text.length > 150 ? '...' : ''}
                    </p>
                  </div>

                  {/* Action buttons */}
                  {!isSelectionMode && (
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <button
                        onClick={() => onResumeGame(game)}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-green-400 transition-colors"
                      >
                        <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Resume Adventure
                      </button>
                      <button
                        onClick={() => handleDeleteGame(game.gameId)}
                        disabled={deletingGameId === game.gameId}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingGameId === game.gameId ? (
                          <>
                            <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="hidden sm:inline">Deleting...</span>
                            <span className="sm:hidden">...</span>
                          </>
                        ) : (
                          <>
                            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span className="hidden sm:inline">Delete</span>
                            <span className="sm:hidden">Delete</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedGamesList;