import React, { useState, useCallback } from 'react';
import { MarkdownParser } from '../utils/MarkdownParser';
import type { Choice } from '../types';

interface ChoicePanelProps {
  choices: Choice[];
  choiceHistory: Choice[];
  isLoading: boolean;
  disabled?: boolean;
  onChoiceSelect: (choice: Choice) => void;
}

/**
 * ChoicePanel component provides choice selection interface with clear visual distinction,
 * choice history tracking and display, and user interaction feedback.
 * 
 * Requirements addressed:
 * - 2.3: Choice selection interface with clear visual distinction
 * - 3.1: User interaction feedback and selection handling
 * - 3.3: Choice history tracking and display
 * - 6.4: Visually distinct and easy to select choices
 */
export const ChoicePanel: React.FC<ChoicePanelProps> = ({
  choices,
  choiceHistory,
  isLoading,
  disabled = false,
  onChoiceSelect
}) => {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [showChoiceHistory, setShowChoiceHistory] = useState(false);

  const handleChoiceClick = useCallback((choice: Choice) => {
    if (disabled || isLoading) return;

    setSelectedChoiceId(choice.id);

    // Add visual feedback delay before calling the handler
    setTimeout(() => {
      onChoiceSelect(choice);
      setSelectedChoiceId(null);
    }, 150);
  }, [disabled, isLoading, onChoiceSelect]);



  // No choices available
  if (!choices || choices.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <svg className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p>No choices available at the moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Choice History Toggle */}
      {choiceHistory.length > 0 && (
        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowChoiceHistory(!showChoiceHistory)}
            className="inline-flex items-center text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            <svg
              className={`mr-1 h-4 w-4 transform transition-transform ${showChoiceHistory ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showChoiceHistory ? 'Hide' : 'Show'} Choice History ({choiceHistory.length})
          </button>
        </div>
      )}

      {/* Choice History */}
      {showChoiceHistory && choiceHistory.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Previous Choices</h3>
          <div className="space-y-2">
            {choiceHistory.map((choice, index) => (
              <div key={`${choice.id}-${index}`} className="flex items-start space-x-3">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  choice.isCustom 
                    ? 'bg-purple-100 dark:bg-purple-900/30' 
                    : 'bg-blue-100 dark:bg-blue-900/30'
                }`}>
                  <span className={`text-xs font-medium ${
                    choice.isCustom 
                      ? 'text-purple-600 dark:text-purple-400' 
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {choice.isCustom && (
                    <div className="flex items-center mb-1">
                      <svg className="h-3 w-3 text-purple-600 dark:text-purple-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Custom Action</span>
                    </div>
                  )}
                  <div className={`text-sm leading-relaxed ${
                    choice.isCustom 
                      ? 'text-purple-900 dark:text-purple-200' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    <MarkdownParser text={choice.text} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Choices */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 sm:p-6">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">What do you choose?</h3>

        {isLoading && (
          <div className="text-center py-4">
            <div className="inline-flex items-center text-blue-600 dark:text-blue-400 text-sm">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing your choice...
            </div>
          </div>
        )}

        <div className="space-y-2 sm:space-y-3">
          {choices.map((choice, index) => {
            const isSelected = selectedChoiceId === choice.id;
            const isDisabledState = disabled || isLoading;

            return (
              <button
                key={choice.id}
                onClick={() => handleChoiceClick(choice)}
                disabled={isDisabledState}
                className={`
                  w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 
                  ${isSelected
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-md transform scale-[0.98]'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }
                  ${isDisabledState
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:shadow-md cursor-pointer'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                `}
              >
                <div className="flex items-start space-x-2 sm:space-x-3">
                  <div className={`
                    flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-medium text-xs sm:text-sm
                    ${isSelected
                      ? 'bg-blue-500 dark:bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }
                  `}>
                    {String.fromCharCode(65 + index)} {/* A, B, C, D */}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`
                      text-xs sm:text-sm leading-relaxed break-words
                      ${isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-gray-800 dark:text-gray-200'}
                    `}>
                      <MarkdownParser text={choice.text} />
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex-shrink-0">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>


      </div>
    </div>
  );
};

export default ChoicePanel;