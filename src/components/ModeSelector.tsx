import React, { useState } from 'react';
import { SamplerSettings as SamplerSettingsModal } from './SamplerSettings';
import type { GameMode, SamplerSettings, AIConfig } from '../types';

interface ModeSelectorProps {
  onModeSelect: (mode: GameMode) => void;
  aiConfig: AIConfig | null;
  samplerSettings: SamplerSettings;
  onSamplerSettingsChange: (settings: SamplerSettings) => void;
}

/**
 * ModeSelector component allows users to choose between Standard and Custom game modes.
 * 
 * Requirements addressed:
 * - 1.1: Provide option to start a "Custom Scenario" mode
 * - 4.1: Display clear option to select between modes
 * - 6.1-6.5: Mode selection before game starts
 */
export const ModeSelector: React.FC<ModeSelectorProps> = ({ 
  onModeSelect, 
  aiConfig, 
  samplerSettings, 
  onSamplerSettingsChange
}) => {
  const [showSamplerSettings, setShowSamplerSettings] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8 relative">
        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto flex items-center justify-center h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4 sm:mb-6">
            <svg className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3">
            Choose Your Adventure Mode
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Select how you want to experience your story
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Standard Mode */}
          <button
            onClick={() => onModeSelect('standard')}
            className="group relative bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4 sm:p-6 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <div className="flex items-start mb-3 sm:mb-4">
              <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <svg className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="ml-3 sm:ml-4 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
                  Standard Mode
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Choose from AI-generated options at each step. Perfect for guided storytelling with curated choices.
                </p>
              </div>
            </div>
            <div className="flex items-center text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-medium group-hover:text-blue-700 dark:group-hover:text-blue-300">
              Select Standard Mode
              <svg className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>

          {/* Custom Mode */}
          <button
            onClick={() => onModeSelect('custom')}
            className="group relative bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4 sm:p-6 hover:border-purple-500 dark:hover:border-purple-400 hover:shadow-lg transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-purple-400"
          >
            <div className="flex items-start mb-3 sm:mb-4">
              <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                <svg className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="ml-3 sm:ml-4 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
                  Custom Scenario Mode
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Write your own scene and actions. Complete creative freedom to shape your unique adventure.
                </p>
              </div>
            </div>
            <div className="flex items-center text-xs sm:text-sm text-purple-600 dark:text-purple-400 font-medium group-hover:text-purple-700 dark:group-hover:text-purple-300">
              Select Custom Mode
              <svg className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>
        </div>

        <div className="mt-6 sm:mt-8 space-y-4">
          {/* Sampler Settings Button */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowSamplerSettings(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              AI Sampler
            </button>
          </div>

          <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center flex items-center justify-center">
              <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              You can't switch modes once your adventure begins
            </p>
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

export default ModeSelector;
