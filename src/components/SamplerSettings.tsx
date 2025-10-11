import React, { useState } from 'react';
import type { SamplerSettings as SamplerSettingsType } from '../types';

/**
 * SamplerSettings Component
 * 
 * Provides a modal interface for adjusting AI sampler parameters that control
 * story generation behavior.
 * 
 * To add new sampler settings:
 * 1. Add the new property to SamplerSettings type in types/index.ts
 * 2. Add the default value to DEFAULT_SETTINGS below
 * 3. Add a new settings control section in the render method (follow existing pattern)
 * 4. Update AIService to use the new parameter in API calls if needed
 */

interface SamplerSettingsProps {
  settings: SamplerSettingsType;
  onSettingsChange: (settings: SamplerSettingsType) => void;
  onClose: () => void;
}

const DEFAULT_SETTINGS: SamplerSettingsType = {
  temperature: 0.7,
  minP: 0.05,
  repetitionPenalty: 1.1,
  enableStreaming: true
};

export const SamplerSettings: React.FC<SamplerSettingsProps> = ({
  settings,
  onSettingsChange,
  onClose
}) => {
  const [localSettings, setLocalSettings] = useState<SamplerSettingsType>(settings);

  const handleChange = (key: keyof SamplerSettingsType, value: number | boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Sampler Settings
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Settings */}
        <div className="space-y-6">
          {/* Temperature */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Temperature
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {localSettings.temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={localSettings.temperature}
              onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Controls randomness. Lower = more focused, Higher = more creative
            </p>
          </div>

          {/* Min P */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Min P
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {localSettings.minP.toFixed(3)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.001"
              value={localSettings.minP}
              onChange={(e) => handleChange('minP', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Minimum probability threshold for token selection
            </p>
          </div>

          {/* Repetition Penalty */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Repetition Penalty
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {localSettings.repetitionPenalty.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="2"
              step="0.01"
              value={localSettings.repetitionPenalty}
              onChange={(e) => handleChange('repetitionPenalty', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Reduces repetitive text. Higher = less repetition
            </p>
          </div>

          {/* Enable Streaming */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Enable Text Streaming
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Show text as it's generated character by character
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={localSettings.enableStreaming ?? true}
                onClick={() => handleChange('enableStreaming', !(localSettings.enableStreaming ?? true))}
                className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                  transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  ${(localSettings.enableStreaming ?? true) ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                `}
              >
                <span
                  aria-hidden="true"
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                    transition duration-200 ease-in-out
                    ${(localSettings.enableStreaming ?? true) ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-md transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SamplerSettings;
