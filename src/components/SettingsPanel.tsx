import React, { useState, useEffect } from 'react';
import type { AIConfig, ModelInfo, ImageProvider } from '../types';
import { AIConfigValidator, URLValidator } from '../utils';
import { ModelService, ModelServiceError } from '../services';

interface SettingsPanelProps {
  config: AIConfig | null;
  onConfigSave: (config: AIConfig) => void;
  onClose?: () => void;
  className?: string;
}

interface FormState {
  apiKey: string;
  baseUrl: string;
  model: string;
  // Reasoning toggle
  enableReasoning: boolean;
  // Image generation toggle
  enableImageGeneration: boolean;
  // Image configuration
  enableImageConfig: boolean;
  imageProvider: ImageProvider;
  imageApiKey: string;
  imageBaseUrl: string;
  imageModel: string;
}

interface ValidationState {
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface LoadingState {
  models: boolean;
  testing: boolean;
  saving: boolean;
  imageModels: boolean;
  imageTesting: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  config,
  onConfigSave,
  onClose,
  className = ''
}) => {
  // Form state
  const [formState, setFormState] = useState<FormState>({
    apiKey: config?.apiKey || '',
    baseUrl: config?.baseUrl || 'https://api.openai.com/v1',
    model: config?.model || 'gpt-3.5-turbo',
    enableReasoning: config?.enableReasoning ?? true,
    enableImageGeneration: config?.enableImageGeneration ?? true,
    enableImageConfig: !!config?.imageConfig,
    imageProvider: config?.imageConfig?.provider || 'openai',
    imageApiKey: config?.imageConfig?.apiKey || '',
    imageBaseUrl: config?.imageConfig?.baseUrl || '',
    imageModel: config?.imageConfig?.model || 'dall-e-3'
  });

  // Available models
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>(
    config?.availableModels?.map(id => ({ id, name: id })) || []
  );

  // Available image models
  const [availableImageModels, setAvailableImageModels] = useState<ModelInfo[]>(
    config?.imageConfig?.availableModels?.map(id => ({ id, name: id })) || []
  );

  // Validation state
  const [validation, setValidation] = useState<ValidationState>({
    errors: [],
    warnings: [],
    isValid: false
  });

  // Loading states
  const [loading, setLoading] = useState<LoadingState>({
    models: false,
    testing: false,
    saving: false,
    imageModels: false,
    imageTesting: false
  });

  // Connection test result
  const [connectionTest, setConnectionTest] = useState<{
    tested: boolean;
    success: boolean;
    error?: string;
  }>({ tested: false, success: false });

  // Image connection test result
  const [imageConnectionTest, setImageConnectionTest] = useState<{
    tested: boolean;
    success: boolean;
    error?: string;
  }>({ tested: false, success: false });

  // Validate form whenever form state changes
  useEffect(() => {
    const tempConfig: Partial<AIConfig> = {
      apiKey: formState.apiKey,
      baseUrl: formState.baseUrl,
      model: formState.model,
      enableImageGeneration: formState.enableImageGeneration
    };

    // Add image config if enabled
    if (formState.enableImageConfig) {
      tempConfig.imageConfig = {
        provider: formState.imageProvider,
        apiKey: formState.imageApiKey || undefined,
        baseUrl: formState.imageBaseUrl || undefined,
        model: formState.imageModel
      };
    }

    const validationResult = AIConfigValidator.validateConfig(tempConfig);
    setValidation(validationResult);
  }, [formState]);

  // Handle form field changes
  const handleFieldChange = (field: keyof FormState, value: string | boolean) => {
    setFormState(prev => ({ ...prev, [field]: value }));

    // Reset connection test when API key or base URL changes
    if (field === 'apiKey' || field === 'baseUrl') {
      setConnectionTest({ tested: false, success: false });
      setAvailableModels([]);
    }

    // Reset image connection test when image API key, base URL, or provider changes
    if (field === 'imageApiKey' || field === 'imageBaseUrl' || field === 'imageProvider') {
      setImageConnectionTest({ tested: false, success: false });
      setAvailableImageModels([]);

      // Set default model and base URL based on provider
      if (field === 'imageProvider') {
        if (value === 'nano-gpt') {
          setFormState(prev => ({
            ...prev,
            [field]: value,
            imageModel: 'flux-1.1-pro',
            imageBaseUrl: prev.imageBaseUrl || 'https://nano-gpt.com'
          }));
          return; // Early return to avoid the general field update below
        } else if (value === 'openai') {
          setFormState(prev => ({
            ...prev,
            [field]: value,
            imageModel: 'dall-e-3',
            imageBaseUrl: prev.imageBaseUrl || 'https://api.openai.com/v1'
          }));
          return; // Early return to avoid the general field update below
        }
      }
    }

    // Reset image connection test when image config is disabled
    if (field === 'enableImageConfig' && !value) {
      setImageConnectionTest({ tested: false, success: false });
      setAvailableImageModels([]);
    }
  };

  // Test API connection and fetch models
  const handleTestConnection = async () => {
    if (!validation.isValid) return;

    setLoading(prev => ({ ...prev, testing: true, models: true }));
    setConnectionTest({ tested: false, success: false });

    try {
      const testConfig: AIConfig = {
        apiKey: formState.apiKey,
        baseUrl: URLValidator.normalizeBaseURL(formState.baseUrl),
        model: formState.model,
        availableModels: []
      };

      // Test connection and fetch models
      const models = await ModelService.fetchAvailableModels(testConfig);
      const textModels = ModelService.filterTextModels(models);

      setAvailableModels(textModels);
      setConnectionTest({ tested: true, success: true });

      // Auto-select first model if current selection is not available
      if (!textModels.some(m => m.id === formState.model) && textModels.length > 0) {
        setFormState(prev => ({ ...prev, model: textModels[0].id }));
      }

    } catch (error) {
      const errorMessage = error instanceof ModelServiceError
        ? error.message
        : 'Failed to connect to API';

      setConnectionTest({
        tested: true,
        success: false,
        error: errorMessage
      });
      setAvailableModels([]);
    } finally {
      setLoading(prev => ({ ...prev, testing: false, models: false }));
    }
  };

  // Retry model fetching
  const handleRetryModels = async () => {
    if (!validation.isValid) return;

    setLoading(prev => ({ ...prev, models: true }));

    try {
      const testConfig: AIConfig = {
        apiKey: formState.apiKey,
        baseUrl: URLValidator.normalizeBaseURL(formState.baseUrl),
        model: formState.model,
        availableModels: []
      };

      const models = await ModelService.fetchModelsWithRetry(testConfig);
      const textModels = ModelService.filterTextModels(models);
      setAvailableModels(textModels);

    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoading(prev => ({ ...prev, models: false }));
    }
  };

  // Test image API connection and fetch image models
  const handleTestImageConnection = async () => {
    if (!formState.enableImageConfig || !validation.isValid) return;

    setLoading(prev => ({ ...prev, imageTesting: true, imageModels: true }));
    setImageConnectionTest({ tested: false, success: false });

    try {
      const testConfig: AIConfig = {
        apiKey: formState.apiKey,
        baseUrl: URLValidator.normalizeBaseURL(formState.baseUrl),
        model: formState.model,
        availableModels: [],
        imageConfig: {
          provider: formState.imageProvider,
          apiKey: formState.imageApiKey || undefined,
          baseUrl: formState.imageBaseUrl ? URLValidator.normalizeBaseURL(formState.imageBaseUrl) : undefined,
          model: formState.imageModel,
          availableModels: []
        }
      };

      // For nano-gpt, we can't fetch models, so just test the connection
      if (formState.imageProvider === 'nano-gpt') {
        const connectionResult = await ModelService.testImageConnection(testConfig);
        if (connectionResult.success) {
          setImageConnectionTest({ tested: true, success: true });
          setAvailableImageModels([]); // No models to fetch for nano-gpt
        } else {
          setImageConnectionTest({
            tested: true,
            success: false,
            error: connectionResult.error
          });
        }
      } else {
        // For OpenAI compatible, test connection and fetch image models
        let imageModels = await ModelService.fetchAvailableImageModels(testConfig);

        // If no image models found with filtering, get all models
        if (imageModels.length === 0) {
          console.log('No image models found with filtering, fetching all models...');
          imageModels = await ModelService.fetchAllModelsForImageConfig(testConfig);
        }

        setAvailableImageModels(imageModels);
        setImageConnectionTest({ tested: true, success: true });

        // Auto-select first model if current selection is not available
        if (!imageModels.some(m => m.id === formState.imageModel) && imageModels.length > 0) {
          setFormState(prev => ({ ...prev, imageModel: imageModels[0].id }));
        }
      }

    } catch (error) {
      const errorMessage = error instanceof ModelServiceError
        ? error.message
        : 'Failed to connect to image API';

      setImageConnectionTest({
        tested: true,
        success: false,
        error: errorMessage
      });
      setAvailableImageModels([]);
    } finally {
      setLoading(prev => ({ ...prev, imageTesting: false, imageModels: false }));
    }
  };

  // Retry image model fetching
  const handleRetryImageModels = async () => {
    if (!formState.enableImageConfig || !validation.isValid) return;

    setLoading(prev => ({ ...prev, imageModels: true }));

    try {
      const testConfig: AIConfig = {
        apiKey: formState.apiKey,
        baseUrl: URLValidator.normalizeBaseURL(formState.baseUrl),
        model: formState.model,
        availableModels: [],
        imageConfig: {
          provider: formState.imageProvider,
          apiKey: formState.imageApiKey || undefined,
          baseUrl: formState.imageBaseUrl ? URLValidator.normalizeBaseURL(formState.imageBaseUrl) : undefined,
          model: formState.imageModel,
          availableModels: []
        }
      };

      // For nano-gpt, we can't fetch models
      if (formState.imageProvider === 'nano-gpt') {
        setAvailableImageModels([]);
        return;
      }

      let imageModels = await ModelService.fetchImageModelsWithRetry(testConfig);

      // If no image models found with filtering, get all models
      if (imageModels.length === 0) {
        console.log('No image models found with filtering in retry, fetching all models...');
        imageModels = await ModelService.fetchAllModelsForImageConfig(testConfig);
      }

      setAvailableImageModels(imageModels);

    } catch (error) {
      console.error('Failed to fetch image models:', error);
    } finally {
      setLoading(prev => ({ ...prev, imageModels: false }));
    }
  };

  // Save configuration
  const handleSave = async () => {
    if (!validation.isValid) return;

    setLoading(prev => ({ ...prev, saving: true }));

    try {
      const configToSanitize: Partial<AIConfig> = {
        apiKey: formState.apiKey,
        baseUrl: formState.baseUrl,
        model: formState.model,
        enableReasoning: formState.enableReasoning,
        enableImageGeneration: formState.enableImageGeneration,
        samplerSettings: config?.samplerSettings // Include sampler settings in sanitization
      };

      // Add image config if enabled
      if (formState.enableImageConfig) {
        configToSanitize.imageConfig = {
          provider: formState.imageProvider,
          apiKey: formState.imageApiKey || undefined,
          baseUrl: formState.imageBaseUrl || undefined,
          model: formState.imageModel,
          availableModels: availableImageModels.map(m => m.id)
        };
      }

      const sanitizedConfig = AIConfigValidator.sanitizeConfig(configToSanitize);
      const finalConfig: AIConfig = {
        apiKey: sanitizedConfig.apiKey!,
        baseUrl: sanitizedConfig.baseUrl!,
        model: sanitizedConfig.model!,
        availableModels: availableModels.map(m => m.id),
        enableReasoning: formState.enableReasoning,
        enableImageGeneration: sanitizedConfig.enableImageGeneration,
        imageConfig: sanitizedConfig.imageConfig,
        samplerSettings: sanitizedConfig.samplerSettings // Use sanitized sampler settings
      };

      onConfigSave(finalConfig);
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 sm:p-6 max-w-2xl mx-auto ${className}`}>
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">API Configuration</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-2xl sm:text-xl font-bold flex-shrink-0 ml-2"
            aria-label="Close settings"
          >
            ×
          </button>
        )}
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* API Key Input */}
        <div>
          <label htmlFor="apiKey" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Key *
          </label>
          <input
            id="apiKey"
            type="password"
            value={formState.apiKey}
            onChange={(e) => handleFieldChange('apiKey', e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Your OpenAI-compatible API key. For local LLMs, use any 8+ character string like "12345678". This is stored locally and never sent to our servers.
          </p>
        </div>

        {/* Base URL Input */}
        <div>
          <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Base URL *
          </label>
          <input
            id="baseUrl"
            type="url"
            value={formState.baseUrl}
            onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The base URL for your OpenAI-compatible API endpoint. For local LLMs with CORS enabled use something like http://127.0.0.1:1234/v1
          </p>
        </div>

        {/* Connection Test Button */}
        <div>
          <button
            onClick={handleTestConnection}
            disabled={!validation.isValid || loading.testing}
            className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading.testing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Testing Connection...
              </>
            ) : (
              'Test Connection & Fetch Models'
            )}
          </button>

          {/* Connection Test Result */}
          {connectionTest.tested && (
            <div className={`mt-2 p-3 rounded-md ${connectionTest.success
              ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}>
              {connectionTest.success ? (
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  Connection successful! Found {availableModels.length} compatible models.
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-600 dark:text-red-400">✗</span>
                    Connection failed
                  </div>
                  {connectionTest.error && (
                    <p className="text-sm">{connectionTest.error}</p>
                  )}
                  <button
                    onClick={handleTestConnection}
                    className="text-sm underline hover:no-underline mt-1"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Model *
          </label>
          <div className="flex gap-2">
            <select
              id="model"
              value={formState.model}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableModels.length === 0 ? (
                <option value={formState.model}>{formState.model}</option>
              ) : (
                availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))
              )}
            </select>

            {availableModels.length === 0 && !loading.models && (
              <button
                onClick={handleRetryModels}
                disabled={!validation.isValid}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              >
                Fetch Models
              </button>
            )}
          </div>

          {loading.models && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 dark:border-gray-400"></div>
              Loading available models...
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {availableModels.length === 0
              ? 'Test connection first to load available models'
              : `Choose from ${availableModels.length} available text generation models`
            }
          </p>
        </div>

        {/* Reasoning Toggle */}
        <div className="border-t dark:border-gray-700 pt-6">
          <div className="flex items-center gap-3 mb-2">
            <input
              id="enableReasoning"
              type="checkbox"
              checked={formState.enableReasoning}
              onChange={(e) => handleFieldChange('enableReasoning', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="enableReasoning" className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Show AI Reasoning
            </label>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Display the AI's thinking process and reasoning. When disabled, only the final response is shown for cleaner output.
          </p>
        </div>

        {/* Image Generation Toggle */}
        <div className="border-t dark:border-gray-700 pt-6">
          <div className="flex items-center gap-3 mb-2">
            <input
              id="enableImageGeneration"
              type="checkbox"
              checked={formState.enableImageGeneration}
              onChange={(e) => handleFieldChange('enableImageGeneration', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="enableImageGeneration" className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Enable Image Generation
            </label>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Generate AI images for each story scene. Disable this to play without images for faster story generation.
          </p>
        </div>

        {/* Image Configuration Section */}
        {formState.enableImageGeneration && (
          <div className="border-t dark:border-gray-700 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <input
                id="enableImageConfig"
                type="checkbox"
                checked={formState.enableImageConfig}
                onChange={(e) => handleFieldChange('enableImageConfig', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="enableImageConfig" className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Separate Image Generation Configuration
              </label>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Configure a separate API endpoint and model for image generation. If disabled, the main configuration will be used for both text and images.
            </p>

            {formState.enableImageConfig && (
              <div className="space-y-4 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                {/* Image Provider Selection */}
                <div>
                  <label htmlFor="imageProvider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Image Provider *
                  </label>
                  <select
                    id="imageProvider"
                    value={formState.imageProvider}
                    onChange={(e) => handleFieldChange('imageProvider', e.target.value as ImageProvider)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="openai">OpenAI Compatible (DALL-E, etc.)</option>
                    <option value="nano-gpt">Nano-GPT</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Select the image generation service provider. Different providers use different API formats.
                  </p>
                </div>

                {/* Image API Key Input */}
                <div>
                  <label htmlFor="imageApiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Image API Key
                  </label>
                  <input
                    id="imageApiKey"
                    type="password"
                    value={formState.imageApiKey}
                    onChange={(e) => handleFieldChange('imageApiKey', e.target.value)}
                    placeholder="Leave empty to use main API key"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Optional: Use a different API key for image generation. Leave empty to use the main API key.
                  </p>
                </div>

                {/* Image Base URL Input */}
                <div>
                  <label htmlFor="imageBaseUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Image Base URL
                  </label>
                  <input
                    id="imageBaseUrl"
                    type="url"
                    value={formState.imageBaseUrl}
                    onChange={(e) => handleFieldChange('imageBaseUrl', e.target.value)}
                    placeholder={
                      formState.imageProvider === 'nano-gpt'
                        ? 'https://nano-gpt.com'
                        : 'https://api.openai.com/v1'
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Optional: Use a different base URL for image generation. Leave empty to use the main base URL.
                    {formState.imageProvider === 'nano-gpt' && ' For nano-gpt, use: https://nano-gpt.com'}
                  </p>
                </div>

                {/* Image Connection Test Button */}
                <div>
                  <button
                    onClick={handleTestImageConnection}
                    disabled={!validation.isValid || loading.imageTesting}
                    className="bg-purple-600 dark:bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading.imageTesting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Testing Image Connection...
                      </>
                    ) : (
                      'Test Image Connection & Fetch Models'
                    )}
                  </button>

                  {/* Image Connection Test Result */}
                  {imageConnectionTest.tested && (
                    <div className={`mt-2 p-3 rounded-md ${imageConnectionTest.success
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                      }`}>
                      {imageConnectionTest.success ? (
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 dark:text-green-400">✓</span>
                          {formState.imageProvider === 'nano-gpt'
                            ? 'Image connection validated! Enter your model name manually below.'
                            : `Image connection successful! Found ${availableImageModels.length} compatible image models.`
                          }
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-red-600 dark:text-red-400">✗</span>
                            Image connection failed
                          </div>
                          {imageConnectionTest.error && (
                            <p className="text-sm">{imageConnectionTest.error}</p>
                          )}
                          <button
                            onClick={handleTestImageConnection}
                            className="text-sm underline hover:no-underline mt-1"
                          >
                            Try again
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Image Model Selection */}
                <div>
                  <label htmlFor="imageModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Image Model *
                  </label>

                  {formState.imageProvider === 'nano-gpt' ? (
                    // Manual input for nano-gpt
                    <div>
                      <input
                        id="imageModel"
                        type="text"
                        value={formState.imageModel}
                        onChange={(e) => handleFieldChange('imageModel', e.target.value)}
                        placeholder="Enter model name (e.g., flux-1.1-pro, stable-diffusion-xl)"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Enter the exact model name as required by nano-gpt. Common models: flux-1.1-pro, stable-diffusion-xl, dall-e-3
                      </p>
                    </div>
                  ) : (
                    // Dropdown for OpenAI compatible
                    <div>
                      <div className="flex gap-2">
                        <select
                          id="imageModel"
                          value={formState.imageModel}
                          onChange={(e) => handleFieldChange('imageModel', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {availableImageModels.length === 0 ? (
                            <option value={formState.imageModel}>{formState.imageModel}</option>
                          ) : (
                            availableImageModels.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))
                          )}
                        </select>

                        {availableImageModels.length === 0 && !loading.imageModels && (
                          <button
                            onClick={handleRetryImageModels}
                            disabled={!validation.isValid}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                          >
                            Fetch Models
                          </button>
                        )}
                      </div>

                      {loading.imageModels && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 dark:border-gray-400"></div>
                          Loading available image models...
                        </div>
                      )}

                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {availableImageModels.length === 0
                          ? 'Test image connection first to load available models'
                          : `Choose from ${availableImageModels.length} available image generation models`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Validation Messages */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="space-y-2">
            {validation.errors.map((error, index) => (
              <div key={`error-${index}`} className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded">
                {error}
              </div>
            ))}
            {validation.warnings.map((warning, index) => (
              <div key={`warning-${index}`} className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded">
                {warning}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={!validation.isValid || loading.saving}
            className="bg-green-600 dark:bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading.saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-6 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};