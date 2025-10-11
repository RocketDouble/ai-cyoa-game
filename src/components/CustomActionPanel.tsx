import React, { useState, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Choice } from '../types';

interface CustomActionPanelProps {
  isLoading: boolean;
  disabled?: boolean;
  onActionSubmit: (actionText: string) => void;
  choiceHistory: Choice[];
}

/**
 * CustomActionPanel component provides freeform text input for custom scenario mode
 * with validation, character counting, and custom action history display.
 * 
 * Requirements addressed:
 * - 2.1: Text input field for custom actions
 * - 2.2: Accept text input between 5 and 200 characters
 * - 2.3: Submit valid custom actions
 * - 2.4, 2.5: Display validation error messages
 * - 4.2: Text input area instead of choice buttons
 * - 4.3: Placeholder text indicating user should type their action
 * - 4.4: Submit button to send custom action
 * - 4.5: Character count indicator
 * - 7.1-7.5: Custom action history display with distinct styling
 * - 8.1-8.6: Validation and error handling
 */
export const CustomActionPanel: React.FC<CustomActionPanelProps> = ({
  isLoading,
  disabled = false,
  onActionSubmit,
  choiceHistory
}) => {
  const [actionText, setActionText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const MIN_LENGTH = 5;
  const MAX_LENGTH = 200;

  // Real-time validation
  const validateInput = useCallback((text: string): string | null => {
    const trimmedText = text.trim();
    
    if (trimmedText.length === 0) {
      return 'Please enter an action';
    }
    
    if (trimmedText.length < MIN_LENGTH) {
      return `Action must be at least ${MIN_LENGTH} characters`;
    }
    
    if (trimmedText.length > MAX_LENGTH) {
      return `Action must not exceed ${MAX_LENGTH} characters`;
    }
    
    return null;
  }, []);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    
    // Prevent input beyond max length
    if (newText.length <= MAX_LENGTH) {
      setActionText(newText);
      
      // Clear error when user starts typing after an error
      if (error && newText.trim().length > 0) {
        setError(null);
      }
    }
  }, [error]);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    
    if (disabled || isLoading) return;

    const validationError = validateInput(actionText);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    // Submit the action
    onActionSubmit(actionText.trim());
    
    // Clear the input and error
    setActionText('');
    setError(null);
  }, [actionText, disabled, isLoading, onActionSubmit, validateInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter without Shift - submit the form
      e.preventDefault();
      if (!disabled && !isLoading && actionText.trim().length > 0) {
        const validationError = validateInput(actionText);
        
        if (validationError) {
          setError(validationError);
          return;
        }

        // Submit the action
        onActionSubmit(actionText.trim());
        
        // Clear the input and error
        setActionText('');
        setError(null);
      }
    }
    // Shift+Enter allows normal newline behavior (default textarea behavior)
  }, [disabled, isLoading, actionText, validateInput, onActionSubmit]);

  const characterCount = actionText.length;
  const isNearLimit = characterCount > MAX_LENGTH * 0.9;
  const isOverLimit = characterCount > MAX_LENGTH;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Custom Action History Toggle */}
      {choiceHistory.length > 0 && (
        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center text-xs sm:text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
          >
            <svg
              className={`mr-1 h-4 w-4 transform transition-transform ${showHistory ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showHistory ? 'Hide' : 'Show'} Action History ({choiceHistory.length})
          </button>
        </div>
      )}

      {/* Custom Action History */}
      {showHistory && choiceHistory.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Your Actions</h3>
          <div className="space-y-2">
            {choiceHistory.map((choice, index) => (
              <div key={`${choice.id}-${index}`} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {choice.text}
                  </div>
                  {choice.isCustom && (
                    <span className="inline-flex items-center mt-1 text-xs text-purple-600 dark:text-purple-400">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                      Custom Action
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Action Input */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 sm:p-6">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
          What do you do?
        </h3>

        {isLoading && (
          <div className="text-center py-4">
            <div className="inline-flex items-center text-purple-600 dark:text-purple-400 text-sm">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600 dark:text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing your action...
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <textarea
              value={actionText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={disabled || isLoading}
              placeholder="Type your action here... (e.g., 'I carefully examine the mysterious door' or 'I call out to see if anyone is nearby')"
              className={`
                w-full px-3 py-3 sm:px-4 sm:py-3 rounded-lg border-2 transition-all duration-200
                text-sm sm:text-base leading-relaxed
                resize-none
                ${error
                  ? 'border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500 dark:focus:ring-purple-400'
                }
                ${disabled || isLoading
                  ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-50'
                  : 'bg-white dark:bg-gray-700 hover:border-purple-300 dark:hover:border-purple-500'
                }
                text-gray-900 dark:text-gray-100
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800
              `}
              rows={3}
              maxLength={MAX_LENGTH}
            />
            
            {/* Character Counter */}
            <div className="flex justify-between items-center mt-2">
              <div>
                {error && (
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </p>
                )}
              </div>
              <span className={`
                text-xs sm:text-sm font-medium
                ${isOverLimit
                  ? 'text-red-600 dark:text-red-400'
                  : isNearLimit
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-500 dark:text-gray-400'
                }
              `}>
                {characterCount} / {MAX_LENGTH}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={disabled || isLoading || actionText.trim().length === 0}
            className={`
              w-full py-3 px-4 rounded-lg font-medium text-sm sm:text-base
              transition-all duration-200
              ${disabled || isLoading || actionText.trim().length === 0
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]'
              }
              focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800
            `}
          >
            {isLoading ? 'Processing...' : 'Submit Action'}
          </button>
        </form>

        {/* Helper Text */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center flex items-center justify-center">
              <svg className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Tip: Be creative! Describe what your character does, says, or thinks.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Press Enter to submit • Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomActionPanel;
