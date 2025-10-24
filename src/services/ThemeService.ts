import type { ThemeConfig } from '../types/index';

export class ThemeServiceError extends Error {
  public cause?: Error;
  
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ThemeServiceError';
    this.cause = cause;
  }
}

/**
 * Logger utility for ThemeService operations
 */
class ThemeLogger {
  private static readonly LOG_PREFIX = '[ThemeService]';

  static info(message: string, data?: any): void {
    console.log(`${this.LOG_PREFIX} ${message}`, data ? data : '');
  }

  static warn(message: string, error?: any): void {
    console.warn(`${this.LOG_PREFIX} WARNING: ${message}`, error ? error : '');
  }

  static error(message: string, error?: any): void {
    console.error(`${this.LOG_PREFIX} ERROR: ${message}`, error ? error : '');
  }

  static debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`${this.LOG_PREFIX} DEBUG: ${message}`, data ? data : '');
    }
  }
}

export class ThemeService {
  private static cachedThemes: ThemeConfig | null = null;

  /**
   * Loads theme configuration from themes.json file
   * @returns Promise<ThemeConfig> The loaded and validated theme configuration
   * @throws ThemeServiceError if loading or validation fails
   */
  static async loadThemes(): Promise<ThemeConfig> {
    try {
      ThemeLogger.debug('Attempting to load theme configuration');
      
      // Return cached themes if available
      if (this.cachedThemes) {
        ThemeLogger.debug('Returning cached theme configuration');
        return this.cachedThemes;
      }

      // Import the themes configuration
      let themesModule;
      try {
        themesModule = await import('../config/themes.json');
      } catch (importError) {
        ThemeLogger.error('Failed to import themes.json file', importError);
        
        // Check if it's a file not found error
        if (importError instanceof Error && importError.message.includes('Cannot resolve module')) {
          throw new ThemeServiceError(
            'Theme configuration file not found. Please ensure themes.json exists in src/config/',
            importError
          );
        }
        
        throw new ThemeServiceError(
          'Failed to load theme configuration file',
          importError instanceof Error ? importError : undefined
        );
      }

      const themesData = themesModule.default || themesModule;
      ThemeLogger.debug('Theme configuration file loaded successfully');

      // Validate the configuration
      if (!this.validateThemeConfig(themesData)) {
        ThemeLogger.error('Theme configuration validation failed', themesData);
        throw new ThemeServiceError('Invalid theme configuration format. Please check the themes.json file structure.');
      }

      // Cache the validated configuration
      this.cachedThemes = themesData as ThemeConfig;
      
      // Themes loaded successfully - only log if there are issues
      return this.cachedThemes;
    } catch (error) {
      if (error instanceof ThemeServiceError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ThemeLogger.error('Unexpected error during theme loading', error);
      throw new ThemeServiceError(
        `Failed to load theme configuration: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validates the theme configuration format
   * @param config The configuration object to validate
   * @returns boolean True if valid, false otherwise
   */
  static validateThemeConfig(config: unknown): boolean {
    try {
      ThemeLogger.debug('Validating theme configuration format');
      
      if (!config || typeof config !== 'object') {
        ThemeLogger.warn('Theme configuration is not an object');
        return false;
      }

      const themeConfig = config as Record<string, unknown>;

      // Check required top-level properties
      if (typeof themeConfig.version !== 'string') {
        ThemeLogger.warn('Theme configuration missing or invalid version field');
        return false;
      }
      
      if (typeof themeConfig.lastUpdated !== 'string') {
        ThemeLogger.warn('Theme configuration missing or invalid lastUpdated field');
        return false;
      }
      
      if (!Array.isArray(themeConfig.themes)) {
        ThemeLogger.warn('Theme configuration missing or invalid themes array');
        return false;
      }

      if (themeConfig.themes.length === 0) {
        ThemeLogger.warn('Theme configuration contains empty themes array');
        return false;
      }

      // Validate each theme
      for (let i = 0; i < themeConfig.themes.length; i++) {
        const theme = themeConfig.themes[i];
        if (!this.validateTheme(theme)) {
          ThemeLogger.warn(`Theme validation failed at index ${i}`, theme);
          return false;
        }
      }

      ThemeLogger.debug(`Theme configuration validation successful: ${themeConfig.themes.length} themes validated`);
      return true;
    } catch (error) {
      ThemeLogger.error('Unexpected error during theme configuration validation', error);
      return false;
    }
  }

  /**
   * Validates a single theme object
   * @param theme The theme object to validate
   * @returns boolean True if valid, false otherwise
   */
  private static validateTheme(theme: unknown): boolean {
    if (!theme || typeof theme !== 'object') {
      return false;
    }

    const themeObj = theme as Record<string, unknown>;

    // Check required properties
    if (typeof themeObj.id !== 'string' || 
        typeof themeObj.name !== 'string' ||
        themeObj.id.trim() === '' ||
        themeObj.name.trim() === '') {
      return false;
    }

    // Check optional properties if they exist
    if (themeObj.description !== undefined && typeof themeObj.description !== 'string') {
      return false;
    }

    if (themeObj.keywords !== undefined && 
        (!Array.isArray(themeObj.keywords) || 
         !themeObj.keywords.every(keyword => typeof keyword === 'string'))) {
      return false;
    }

    return true;
  }

  /**
   * Selects a random theme from the available themes
   * @returns Promise<string | null> The selected theme name, or null if no themes available
   */
  static async selectRandomTheme(): Promise<string | null> {
    try {
      ThemeLogger.debug('Attempting to select random theme');
      
      let themeConfig: ThemeConfig;
      try {
        themeConfig = await this.loadThemes();
      } catch (error) {
        ThemeLogger.warn('Failed to load themes for selection, continuing without theme', error);
        return null;
      }
      
      // Handle empty theme list gracefully
      if (!themeConfig.themes || themeConfig.themes.length === 0) {
        ThemeLogger.warn('No themes available for selection - theme list is empty');
        return null;
      }

      // Select random theme with equal probability distribution
      const randomIndex = Math.floor(Math.random() * themeConfig.themes.length);
      const selectedTheme = themeConfig.themes[randomIndex];
      
      // Validate selected theme before returning
      if (!selectedTheme || !selectedTheme.name || selectedTheme.name.trim() === '') {
        ThemeLogger.warn(`Selected theme at index ${randomIndex} is invalid`, selectedTheme);
        return null;
      }
      
      // Log theme selection
      console.log(`🎭 Selected theme: "${selectedTheme.name}"`);
      
      return selectedTheme.name;
    } catch (error) {
      ThemeLogger.warn('Unexpected error during theme selection, continuing without theme', error);
      return null;
    }
  }

  /**
   * Injects a theme into a story prompt in a natural way
   * @param basePrompt The original prompt to enhance
   * @param theme The theme to inject (optional)
   * @returns string The enhanced prompt with theme context
   */
  static injectThemeIntoPrompt(basePrompt: string, theme?: string): string {
    try {
      ThemeLogger.debug('Attempting theme injection into prompt');
      
      // Validate base prompt
      if (!basePrompt || typeof basePrompt !== 'string' || basePrompt.trim() === '') {
        ThemeLogger.warn('Invalid base prompt provided for theme injection, returning empty string');
        return '';
      }

      // If no theme provided, return original prompt
      if (!theme || typeof theme !== 'string' || theme.trim() === '') {
        ThemeLogger.debug('No theme provided, returning original prompt');
        return basePrompt;
      }

      // Sanitize theme input
      const sanitizedTheme = theme.trim();
      if (sanitizedTheme.length === 0) {
        ThemeLogger.debug('Theme is empty after sanitization, returning original prompt');
        return basePrompt;
      }

      // Create theme context that enhances but doesn't override the prompt structure
      const themeContext = `Set this story in a ${sanitizedTheme} setting. `;
      
      // Inject theme at the beginning to establish context early
      const enhancedPrompt = themeContext + basePrompt;
      
      // Validate the enhanced prompt isn't too long (basic check)
      if (enhancedPrompt.length > 10000) {
        ThemeLogger.warn(`Enhanced prompt is very long (${enhancedPrompt.length} characters), this may cause issues`);
      }
      
      // Theme injection successful - no need to log unless there's an issue
      return enhancedPrompt;
    } catch (error) {
      ThemeLogger.error('Unexpected error during theme injection, returning original prompt', error);
      return basePrompt || '';
    }
  }

  /**
   * Gets all available theme names
   * @returns Promise<string[]> Array of theme names
   */
  static async getAvailableThemes(): Promise<string[]> {
    try {
      ThemeLogger.debug('Retrieving all available theme names');
      
      let themeConfig: ThemeConfig;
      try {
        themeConfig = await this.loadThemes();
      } catch (error) {
        ThemeLogger.warn('Failed to load themes when getting available themes', error);
        return [];
      }
      
      if (!themeConfig.themes || themeConfig.themes.length === 0) {
        ThemeLogger.warn('No themes available - theme list is empty');
        return [];
      }

      const themeNames = themeConfig.themes
        .filter(theme => theme && theme.name && theme.name.trim() !== '')
        .map(theme => theme.name);
      
      ThemeLogger.debug(`Retrieved ${themeNames.length} theme names`);
      return themeNames;
    } catch (error) {
      ThemeLogger.error('Unexpected error while getting available themes', error);
      return [];
    }
  }

  /**
   * Clears the cached theme configuration (useful for testing)
   */
  static clearCache(): void {
    ThemeLogger.debug('Clearing theme configuration cache');
    this.cachedThemes = null;
  }

  /**
   * Checks if the theme system is healthy and operational
   * @returns Promise<{healthy: boolean, error?: string, themeCount?: number}>
   */
  static async healthCheck(): Promise<{healthy: boolean, error?: string, themeCount?: number}> {
    try {
      ThemeLogger.debug('Performing theme system health check');
      
      const themeConfig = await this.loadThemes();
      
      if (!themeConfig.themes || themeConfig.themes.length === 0) {
        return {
          healthy: false,
          error: 'No themes available in configuration',
          themeCount: 0
        };
      }

      // Test theme selection logic without actually selecting (to avoid redundant selections)
      if (themeConfig.themes.length > 0) {
        const testTheme = themeConfig.themes[0]; // Use first theme for testing
        if (!testTheme || !testTheme.name || testTheme.name.trim() === '') {
          return {
            healthy: false,
            error: 'Theme data validation failed - invalid theme structure',
            themeCount: themeConfig.themes.length
          };
        }

        // Test theme injection with the test theme
        const testPrompt = 'This is a test prompt.';
        const injectedPrompt = this.injectThemeIntoPrompt(testPrompt, testTheme.name);
        if (injectedPrompt === testPrompt) {
          return {
            healthy: false,
            error: 'Theme injection failed',
            themeCount: themeConfig.themes.length
          };
        }
      }

      // Health check passed - no need to log unless there are issues
      return {
        healthy: true,
        themeCount: themeConfig.themes.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ThemeLogger.error('Theme system health check failed', error);
      return {
        healthy: false,
        error: errorMessage
      };
    }
  }
}