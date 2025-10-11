import React, { useState } from 'react';
import { SamplerSettings as SamplerSettingsModal } from './SamplerSettings';
import { ThinkingDisplay } from './ThinkingDisplay';
import { AIService } from '../services/AIService';
import { ThinkingParser } from '../utils/ThinkingParser';
import type { AIConfig, SamplerSettings } from '../types';

interface CustomSceneInputProps {
  onSceneSubmit: (sceneDescription: string) => void;
  onBack: () => void;
  aiConfig: AIConfig | null;
  samplerSettings: SamplerSettings;
  onSamplerSettingsChange: (settings: SamplerSettings) => void;
}

/**
 * CustomSceneInput component allows users to provide their own initial scene description
 * for custom scenario mode.
 * 
 * Requirements addressed:
 * - 1.2: Display text input field for initial scene description
 * - 1.3: Accept text input between 20 and 300 characters
 * - 1.5: Display validation error for scenes less than 20 characters
 * - 1.6: Display validation error for scenes exceeding 300 characters
 * - 4.3: Display placeholder text indicating user should type their scene
 * - 4.5: Display character count indicator
 * - 8.2: Display specific error message with minimum character requirement
 * - 8.3: Display specific error message with maximum character requirement
 */
export const CustomSceneInput: React.FC<CustomSceneInputProps> = ({
  onSceneSubmit,
  onBack,
  aiConfig,
  samplerSettings,
  onSamplerSettingsChange
}) => {
  const [sceneText, setSceneText] = useState('');
  const [error, setError] = useState<string>('');
  const [showSamplerSettings, setShowSamplerSettings] = useState(false);
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [sceneError, setSceneError] = useState<string>('');
  const [thinkingContent, setThinkingContent] = useState<string>('');
  const [isStreamingThinking, setIsStreamingThinking] = useState(false);
  const [isStreamingScene, setIsStreamingScene] = useState(false);

  const MIN_CHARS = 20;
  const MAX_CHARS = 500;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setSceneText(text);

    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default new line behavior
      if (isValid) {
        handleSubmit();
      }
    }
    // Shift+Enter will naturally create a new line (default behavior)
  };

  const handleSubmit = () => {
    const trimmedText = sceneText.trim();

    // Validation
    if (trimmedText.length === 0) {
      setError('Please enter a scene description');
      return;
    }

    if (trimmedText.length < MIN_CHARS) {
      setError(`Scene description must be at least ${MIN_CHARS} characters`);
      return;
    }

    if (trimmedText.length > MAX_CHARS) {
      setError(`Scene description must not exceed ${MAX_CHARS} characters`);
      return;
    }

    // Submit valid scene
    onSceneSubmit(trimmedText);
  };

  const generateSceneIdea = async () => {
    if (!aiConfig) {
      setSceneError('AI configuration is required to generate scene ideas');
      return;
    }

    setIsGeneratingScene(true);
    setSceneError('');
    setSceneText(''); // Clear existing text before generating new scene
    setError(''); // Clear any validation errors
    setThinkingContent(''); // Clear previous thinking content
    setIsStreamingThinking(false);

    try {
      const prompt = `Generate a SIMPLE and SHORT opening scene (25-75 words) for a choose-your-own-adventure story. 
Write only the scene description — no dialogue, no choices, no setup notes.

The scene should:
- Set a clear location
- Present a simple situation or problem
- Use straightforward, clear language
- Avoid flowery or overly descriptive language

Keep it SHORT it a SIMPLE scene, NO CHARACTER ACTIONS.`;

      const messages = [
        AIService.createSystemMessage('You are a creative writing assistant specializing in adventure story openings. DO NOT end it with What do you do?'),
        AIService.createUserMessage(prompt)
      ];

      const useStreaming = samplerSettings.enableStreaming ?? true;

      if (useStreaming) {
        setIsStreamingThinking(true);

        // Create a streaming processor to handle thinking/scene separation
        const streamingProcessor = ThinkingParser.createStreamingProcessor();
        let hasStartedSceneStreaming = false;

        const { response, thinkingContent: finalThinkingContent } = await AIService.chatCompletionStream(
          aiConfig,
          messages,
          (chunk: string) => {
            // Process the chunk to separate thinking from scene content
            const processed = streamingProcessor.processChunk(chunk);

            // If we have display content (scene content), stream it to the text box
            if (processed.displayChunk) {
              if (!hasStartedSceneStreaming) {
                // First scene content chunk - switch from thinking to scene streaming
                setIsStreamingThinking(false);
                setIsStreamingScene(true);
                hasStartedSceneStreaming = true;
              }

              setSceneText(prev => prev + processed.displayChunk);
            }
          },
          {
            temperature: samplerSettings?.temperature ?? 0.8,
            maxTokens: 2048,
            onThinkingChunk: (thinkingChunk: string) => {
              setThinkingContent(prev => prev + thinkingChunk);
            }
          }
        );

        setIsStreamingThinking(false);
        setIsStreamingScene(false);

        if (finalThinkingContent) {
          setThinkingContent(finalThinkingContent);
        }

        if (response && response.trim()) {
          // Parse thinking content from the response as a fallback
          const { thinkingContent: parsedThinking, cleanedResponse } = ThinkingParser.parseThinkingResponse(response);

          // Use parsed thinking if we didn't get it from streaming
          if (parsedThinking && !finalThinkingContent) {
            setThinkingContent(parsedThinking);
          }

          // Ensure we have the complete cleaned response in the text box
          // (in case streaming didn't capture everything)
          if (cleanedResponse.trim() && cleanedResponse.trim() !== sceneText.trim()) {
            setSceneText(cleanedResponse.trim());
          }

          setError(''); // Clear any existing errors
        } else {
          setSceneError('Failed to generate scene idea. Please try again.');
        }
      } else {
        // Use regular completion when streaming is disabled
        const response = await AIService.chatCompletionWithRetry(aiConfig, messages, {
          temperature: samplerSettings?.temperature ?? 0.8,
          maxTokens: 2048
        });

        if (response && response.trim()) {
          // Parse thinking content from the response
          const { thinkingContent: parsedThinking, cleanedResponse } = ThinkingParser.parseThinkingResponse(response);

          if (parsedThinking) {
            setThinkingContent(parsedThinking);
          }

          setSceneText(cleanedResponse.trim());
          setError(''); // Clear any existing errors
        } else {
          setSceneError('Failed to generate scene idea. Please try again.');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate scene idea';
      setSceneError(errorMessage);
      console.error('Scene generation error:', err);
    } finally {
      setIsGeneratingScene(false);
      setIsStreamingThinking(false);
      setIsStreamingScene(false);
    }
  };

  const charCount = sceneText.length;
  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const isNearMax = charCount > MAX_CHARS * 0.9;

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
        <div className="text-center mb-6 sm:mb-8 relative">
          {/* Sampler Settings Button - Top Right */}
          <div className="absolute top-0 right-0">
            <button
              onClick={() => setShowSamplerSettings(true)}
              className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Adjust AI settings"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span className="hidden sm:inline">AI Settings</span>
            </button>
          </div>

          <div className="mx-auto flex items-center justify-center h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4 sm:mb-6">
            <svg className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3">
            Set Your Scene
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Describe the initial scene for your custom adventure
          </p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {/* Scene Description Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="sceneDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Scene Description
              </label>
              {aiConfig && (
                <button
                  onClick={generateSceneIdea}
                  disabled={isGeneratingScene}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Generate a scene idea using AI"
                >
                  {isGeneratingScene ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isStreamingThinking ? 'Thinking...' : isStreamingScene ? 'Writing...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                      </svg>
                      ✨ Imagine a Scene
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Thinking Display */}
            {thinkingContent && (
              <div className="mb-3">
                <ThinkingDisplay
                  thinkingContent={thinkingContent}
                  isStreaming={isStreamingThinking}
                />
              </div>
            )}
            <textarea
              id="sceneDescription"
              value={sceneText + (isStreamingScene ? '|' : '')}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="You wake up in a mysterious forest, surrounded by ancient trees. The air is thick with fog, and you hear strange sounds in the distance..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none placeholder-gray-400 dark:placeholder-gray-500"
              readOnly={isStreamingScene}
            />

            {/* Character Counter */}
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {MIN_CHARS}-{MAX_CHARS} characters required
              </p>
              <p className={`text-xs font-medium ${charCount === 0
                ? 'text-gray-500 dark:text-gray-400'
                : isValid
                  ? 'text-green-600 dark:text-green-400'
                  : isNearMax
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                {charCount} / {MAX_CHARS}
              </p>
            </div>

            {/* Error Messages */}
            {error && (
              <div className="mt-2 p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs sm:text-sm">{error}</p>
                </div>
              </div>
            )}

            {sceneError && (
              <div className="mt-2 p-3 rounded-md bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm">{sceneError}</p>
                    {(sceneError.includes('Empty response') || sceneError.includes('API error') || sceneError.includes('Failed to generate')) && (
                      <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-800/30 rounded border border-orange-300 dark:border-orange-600">
                        <p className="text-xs text-orange-700 dark:text-orange-300">
                          <strong>💡 Tip:</strong> If scene generation fails, try adjusting your AI settings,
                          checking your API connection, or writing your own scene description instead.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Helpful Tips */}
          <div className="p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-300 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Tips for a great scene:
            </h3>
            <ul className="text-xs sm:text-sm text-purple-800 dark:text-purple-300 space-y-1">
              <li>• Set the location and atmosphere</li>
              <li>• Describe what your character sees or feels</li>
              <li>• Create an intriguing situation or mystery</li>
              <li>• Leave room for the story to develop</li>
              {aiConfig && (
                <li>• ✨ Use the Imagine tool for AI-generated inspiration</li>
              )}
              <li>• 🧠 If your AI uses thinking, you'll see its reasoning process above</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
            <button
              onClick={onBack}
              disabled={isGeneratingScene}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-500 dark:focus:ring-gray-400 font-medium text-sm sm:text-base"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-purple-500 dark:focus:ring-purple-400 font-medium text-sm sm:text-base shadow-lg hover:shadow-xl disabled:shadow-none"
            >
              Start Adventure →
            </button>
          </div>
        </div>
      </div>

      {/* Sampler Settings Modal */}
      {showSamplerSettings && aiConfig && (
        <SamplerSettingsModal
          onClose={() => setShowSamplerSettings(false)}
          settings={samplerSettings}
          onSettingsChange={onSamplerSettingsChange}
        />
      )}
    </div>
  );
};

export default CustomSceneInput;
