import React, { useState } from 'react';
import { ImageDisplay } from './ImageDisplay';
import { SamplerSettings } from './SamplerSettings';
import { ThinkingDisplay } from './ThinkingDisplay';

import { MarkdownParser } from '../utils/MarkdownParser';
import type { StorySegment, SamplerSettings as SamplerSettingsType } from '../types';

interface StoryDisplayProps {
  currentStory: StorySegment | null;
  storyHistory: StorySegment[];
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  onRegenerate?: () => void;
  isGeneratingImage?: boolean;
  imageError?: string | null;
  onImageRetry?: () => void;
  samplerSettings?: SamplerSettingsType;
  onSamplerSettingsChange?: (settings: SamplerSettingsType) => void;
  streamingText?: string;
  isStreaming?: boolean;
  enableImageGeneration?: boolean;
  canRegenerate?: boolean;
  thinkingContent?: string;
  streamingThinking?: string;
  onRollback?: (segmentIndex: number) => void;
}

/**
 * StoryDisplay component renders the current story segment with proper typography,
 * handles loading states, error display, and provides story history functionality.
 * 
 * Requirements addressed:
 * - 2.2: Display story text with proper formatting
 * - 3.4: Show story history when requested
 * - 6.1: Clean, readable interface optimized for story consumption
 * - 6.2: Appropriate typography and spacing for comfortable reading
 */
export const StoryDisplay: React.FC<StoryDisplayProps> = ({
  currentStory,
  storyHistory,
  isLoading,
  error,
  onRetry,
  onRegenerate,
  isGeneratingImage = false,
  imageError = null,
  onImageRetry,
  samplerSettings,
  onSamplerSettingsChange,
  streamingText = '',
  isStreaming = false,
  enableImageGeneration = true,
  canRegenerate = false,
  thinkingContent = '',
  streamingThinking = '',
  onRollback
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [showSamplerSettings, setShowSamplerSettings] = useState(false);


  const defaultSamplerSettings: SamplerSettingsType = {
    temperature: 0.7,
    minP: 0.05,
    repetitionPenalty: 1.1
  };

  const handleRollbackRequest = (segmentIndex: number) => {
    if (onRollback) {
      onRollback(segmentIndex);
    }
  };

  // Loading state - only show spinner if NOT streaming
  if (isLoading && !isStreaming) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
        <div className="text-center mt-6">
          <div className="inline-flex items-center text-blue-600 dark:text-blue-400">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating story...
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Story Generation Failed</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // No story state - but allow streaming to show even without currentStory
  if (!currentStory && !isStreaming) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <svg className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p>No story to display. Start a new adventure to begin!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Story History Toggle and Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        {storyHistory.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            <svg
              className={`mr-1 h-4 w-4 transform transition-transform ${showHistory ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showHistory ? 'Hide' : 'Show'} Story History ({storyHistory.length})
          </button>
        )}

        <div className="flex items-center gap-2">
          {canRegenerate && onRegenerate && !isLoading && !isStreaming && (
            <button
              onClick={onRegenerate}
              className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
              title="Regenerate this story response with different variations"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Regenerate</span>
            </button>
          )}

          {onSamplerSettingsChange && (
            <button
              onClick={() => setShowSamplerSettings(true)}
              className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Adjust sampler settings"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span className="hidden sm:inline">AI Sampler</span>
            </button>
          )}
        </div>
      </div>

      {/* Sampler Settings Modal */}
      {showSamplerSettings && onSamplerSettingsChange && (
        <SamplerSettings
          settings={samplerSettings || defaultSamplerSettings}
          onSettingsChange={onSamplerSettingsChange}
          onClose={() => setShowSamplerSettings(false)}
        />
      )}



      {/* Story History */}
      {showHistory && storyHistory.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Previous Story Segments</h3>
          <div className="space-y-4">
            {storyHistory.map((segment, index) => {
              const isExpanded = expandedSegments.has(segment.id);
              const shouldTruncate = segment.text.length > 200;
              const displayText = isExpanded || !shouldTruncate
                ? segment.text
                : `${segment.text.substring(0, 200)}...`;

              return (
                <div key={segment.id} className="border-l-2 border-gray-300 dark:border-gray-600 pl-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Segment {index + 1}</div>
                    {/* Only show rollback button if this is not the last segment (current segment) and onRollback is provided */}
                    {index < storyHistory.length - 1 && onRollback && (
                      <button
                        onClick={() => handleRollbackRequest(index)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                        title={`Rollback to this segment (will delete ${storyHistory.length - 1 - index} segments)`}
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Rollback
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    <MarkdownParser text={displayText} />
                  </div>
                  {shouldTruncate && (
                    <button
                      onClick={() => {
                        setExpandedSegments(prev => {
                          const next = new Set(prev);
                          if (next.has(segment.id)) {
                            next.delete(segment.id);
                          } else {
                            next.add(segment.id);
                          }
                          return next;
                        });
                      }}
                      className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Thinking Display */}
      {((thinkingContent && thinkingContent.trim()) || (streamingThinking && streamingThinking.trim())) && (
        <ThinkingDisplay 
          thinkingContent={isStreaming ? streamingThinking : (currentStory?.thinkingContent || thinkingContent)} 
          className="mb-4"
          isStreaming={isStreaming && !!streamingThinking}
        />
      )}

      {/* Current Story Display */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 sm:p-6">
        {/* Streaming indicator when no text yet */}
        {isStreaming && !streamingText && (
          <div className="text-center py-8">
            <div className="inline-flex items-center text-blue-600 dark:text-blue-400">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating story...
            </div>
          </div>
        )}
        
        {/* Story Text */}
        {(streamingText || currentStory) && (
          <div className="prose prose-sm sm:prose-lg max-w-none">
            <div
              className="text-gray-800 dark:text-gray-200 leading-relaxed break-words"
              style={{
                fontSize: 'clamp(0.9rem, 2.5vw, 1.125rem)',
                lineHeight: '1.75',
                fontFamily: 'Georgia, serif'
              }}
            >
              <MarkdownParser text={isStreaming ? streamingText : (currentStory?.text || '')} />
              {isStreaming && streamingText && (
                <span className="inline-block w-2 h-5 bg-blue-500 dark:bg-blue-400 ml-1 animate-pulse"></span>
              )}
            </div>
          </div>
        )}

        {/* Scene Description (for context, not always displayed) */}
        {currentStory?.sceneDescription && !isStreaming && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Scene</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 italic">
              {currentStory.sceneDescription}
            </div>
          </div>
        )}

        {/* Scene Image */}
        {currentStory && !isStreaming && enableImageGeneration && (
          <div className="mt-6">
            <ImageDisplay
              imageUrl={currentStory.imageUrl}
              altText={currentStory.sceneDescription || 'Story scene'}
              isLoading={isGeneratingImage}
              error={imageError}
              onRetry={onImageRetry}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryDisplay;