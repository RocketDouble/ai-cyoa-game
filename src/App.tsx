import React, { useState, useEffect, useCallback } from 'react';
import type { ErrorInfo } from 'react';
import { GameManager } from './components/GameManager';
import { GameLauncher } from './components/GameLauncher';
import { SettingsPanel } from './components/SettingsPanel';
import { WelcomeScreen } from './components/WelcomeScreen';
import { NotificationCenter } from './components/NotificationCenter';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ThemeToggle } from './components/ThemeToggle';
import { ErrorProvider, useError, ThemeProvider } from './contexts';
import { AIConfigStorage, SavedGamesStorage } from './utils/storage';
import { AIConfigValidator } from './utils/validation';
import type { AIConfig, SavedGame, GameMode } from './types';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Something went wrong</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              An unexpected error occurred. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Component
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
    <LoadingIndicator 
      message="Loading your adventure..." 
      size="large"
    />
  </div>
);

// Inner App Component that uses error context
const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<'welcome' | 'launcher' | 'game' | 'settings'>('welcome');
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [gameToResume, setGameToResume] = useState<SavedGame | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [launcherResetKey, setLauncherResetKey] = useState(0);
  const [startWithSavedGames, setStartWithSavedGames] = useState(false);
  
  const { showError, showSuccess, showWarning, clearAllErrors } = useError();

  const initializeApp = useCallback(async () => {
    try {
      setIsLoading(true);
      clearAllErrors();

      // Check for existing configuration
      const config = AIConfigStorage.loadConfig();
      const hasExistingGames = SavedGamesStorage.getGameCount() > 0;
      
      if (config) {
        // Validate existing configuration
        const validation = AIConfigValidator.validateConfig(config);
        if (validation.isValid) {
          setAiConfig(config);
          setCurrentView('launcher');
          setIsFirstTime(false);
          
          // Show warnings if any
          if (validation.warnings.length > 0) {
            validation.warnings.forEach(warning => showWarning(warning));
          }
        } else {
          // Invalid config, treat as first time
          console.warn('Invalid existing config found:', validation.errors);
          showWarning('Your saved configuration is invalid and needs to be updated.');
          setIsFirstTime(true);
          setCurrentView('welcome');
        }
      } else {
        // No config exists
        if (hasExistingGames) {
          // Has games but no config - show settings directly
          setCurrentView('settings');
          setIsFirstTime(false);
          showWarning('Please configure your AI settings to continue playing.');
        } else {
          // True first time user
          setIsFirstTime(true);
          setCurrentView('welcome');
        }
      }

      // Validate and repair saved games storage if needed
      const storageValidation = SavedGamesStorage.validateAndRepairStorage();
      if (!storageValidation.isValid) {
        console.warn('Storage validation issues:', storageValidation.errors);
        if (storageValidation.repairedCount > 0) {
          showWarning(`Repaired ${storageValidation.repairedCount} corrupted saved game(s).`);
        }
        storageValidation.errors.forEach(error => {
          if (!error.includes('Repaired')) {
            showError(error, () => initializeApp());
          }
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize application';
      showError(errorMessage, () => initializeApp());
      console.error('App initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [showError, showWarning, clearAllErrors]);

  // Initialize app and load configuration
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const handleConfigSave = (config: AIConfig) => {
    try {
      // Validate configuration before saving
      const validation = AIConfigValidator.validateConfig(config);
      if (!validation.isValid) {
        showError(`Configuration validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      AIConfigStorage.saveConfig(config);
      setAiConfig(config);
      setCurrentView('launcher');
      setIsFirstTime(false);
      
      showSuccess('AI configuration saved successfully!');
      
      // Show warnings if any
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => showWarning(warning));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save configuration';
      showError(errorMessage, () => handleConfigSave(config));
      console.error('Config save error:', err);
    }
  };

  const handleWelcomeGetStarted = () => {
    setCurrentView('settings');
  };

  // State for custom scenario mode
  const [gameMode, setGameMode] = useState<GameMode>('standard');
  const [customScene, setCustomScene] = useState<string | undefined>(undefined);
  const [startWithModeSelection, setStartWithModeSelection] = useState(false);

  const handleStartNewGame = (mode: GameMode = 'standard', scene?: string) => {
    setGameToResume(null);
    setGameMode(mode);
    setCustomScene(scene);
    // Reset the flags since we're starting a game
    setStartWithModeSelection(false);
    setStartWithSavedGames(false);
    // Reload config to ensure we have the latest settings
    const config = AIConfigStorage.loadConfig();
    if (config) {
      setAiConfig(config);
    }
    setCurrentView('game');
  };

  const handleResumeGame = (game: SavedGame) => {
    setGameToResume(game);
    // Reset the flags since we're resuming a game
    setStartWithModeSelection(false);
    setStartWithSavedGames(false);
    // Reload config to ensure we have the latest settings
    const config = AIConfigStorage.loadConfig();
    if (config) {
      setAiConfig(config);
    }
    setCurrentView('game');
  };

  const handleConfigurationNeeded = () => {
    // Reload config from storage to pick up any changes made during gameplay
    // (e.g., sampler settings adjusted in GameManager)
    const config = AIConfigStorage.loadConfig();
    if (config) {
      setAiConfig(config);
    }
    setCurrentView('settings');
  };

  const handleBackToLauncher = () => {
    setGameToResume(null);
    // Reload config from storage to pick up any changes made during gameplay
    // (e.g., sampler settings adjusted in GameManager)
    const config = AIConfigStorage.loadConfig();
    if (config) {
      setAiConfig(config);
    }
    
    // If coming from game view or settings, go to saved games page
    if (currentView === 'game' || currentView === 'settings') {
      setStartWithModeSelection(false);
      setStartWithSavedGames(true);
      setCurrentView('launcher');
    } else {
      // From other views, go to welcome screen
      setStartWithModeSelection(false);
      setStartWithSavedGames(false);
      setCurrentView('launcher');
      // Force GameLauncher to reset by incrementing the key
      setLauncherResetKey(prev => prev + 1);
    }
  };

  const handleNewGameFromGameManager = () => {
    setGameToResume(null);
    // Reload config from storage to pick up any changes made during gameplay
    const config = AIConfigStorage.loadConfig();
    if (config) {
      setAiConfig(config);
    }
    // When coming from "New Game" button in GameManager, go to mode selection
    setStartWithModeSelection(true);
    setStartWithSavedGames(false);
    setCurrentView('launcher');
  };

  const handleErrorBoundary = (error: Error, errorInfo: ErrorInfo) => {
    console.error('Global error boundary triggered:', error, errorInfo);
    showError(`Application error: ${error.message}`, () => window.location.reload());
  };

  // Show loading screen during initialization
  if (isLoading) {
    return <LoadingScreen />;
  }



  return (
    <ErrorBoundary onError={handleErrorBoundary}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
        {/* Header Navigation - Hidden on welcome screen */}
        {currentView !== 'welcome' && (
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
            <div className="flex justify-between items-center h-14 sm:h-16">
              {/* Logo/Title */}
              <div className="flex items-center min-w-0">
                <button
                  onClick={handleBackToLauncher}
                  className="flex items-center space-x-2 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex-shrink-0">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h1 className="text-base sm:text-xl font-bold truncate">AI Adventure</h1>
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex items-center space-x-1 sm:space-x-4">
                <ThemeToggle />
                
                {currentView !== 'launcher' && (
                  <button
                    onClick={handleBackToLauncher}
                    className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-xs sm:text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg className="sm:mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                    </svg>
                    <span className="hidden sm:inline">Games</span>
                  </button>
                )}
                
                <button
                  onClick={handleConfigurationNeeded}
                  className={`inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border shadow-sm text-xs sm:text-sm leading-4 font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    currentView === 'settings'
                      ? 'border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <svg className="sm:mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="hidden sm:inline">Settings</span>
                </button>
              </nav>
            </div>
          </div>
        </header>
        )}

        {/* Main Content */}
        <main className={`flex-1 ${currentView === 'welcome' ? '' : 'py-3 sm:py-6'}`}>
          {currentView === 'welcome' && (
            <WelcomeScreen onGetStarted={handleWelcomeGetStarted} />
          )}

          {currentView === 'settings' && (
            <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-8">
              <SettingsPanel
                config={aiConfig}
                onConfigSave={handleConfigSave}
                onClose={isFirstTime ? undefined : () => setCurrentView('launcher')}
              />
            </div>
          )}

          {currentView === 'launcher' && (
            <GameLauncher
              key={launcherResetKey}
              aiConfig={aiConfig}
              onConfigurationNeeded={handleConfigurationNeeded}
              onStartNewGame={handleStartNewGame}
              onResumeGame={handleResumeGame}
              startWithModeSelection={startWithModeSelection}
              startWithSavedGames={startWithSavedGames}
            />
          )}

          {currentView === 'game' && (
            <GameManager
              aiConfig={aiConfig}
              onConfigurationNeeded={handleConfigurationNeeded}
              onBackToLauncher={handleBackToLauncher}
              onNewGame={handleNewGameFromGameManager}
              gameToResume={gameToResume}
              gameMode={gameMode}
              customScene={customScene}
            />
          )}
        </main>

        {/* Footer - Hidden on welcome screen */}
        {currentView !== 'welcome' && (
          <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="max-w-7xl mx-auto py-3 sm:py-4 px-2 sm:px-4 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <p className="text-center sm:text-left">AI-powered CYOA</p>
              <div className="flex items-center space-x-2 sm:space-x-4">
                {aiConfig && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                    Connected
                  </span>
                )}
                <span className="truncate max-w-[150px] sm:max-w-none">Model: {aiConfig?.model || 'Not configured'}</span>
              </div>
            </div>
          </div>
        </footer>
        )}

        {/* Global Notifications */}
        <NotificationCenter />
      </div>
    </ErrorBoundary>
  );
};

// Main App Component with Error Provider and Theme Provider
function App() {
  return (
    <ThemeProvider>
      <ErrorProvider>
        <AppContent />
      </ErrorProvider>
    </ThemeProvider>
  );
}

export default App;
