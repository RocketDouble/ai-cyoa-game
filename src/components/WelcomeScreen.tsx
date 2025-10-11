import React from 'react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

/**
 * WelcomeScreen component for first-time users
 * Provides introduction and guides users to configuration
 * 
 * Requirements addressed:
 * - 1.1: Prompt for API key configuration on first launch
 * - 2.1: Guide users through initial setup
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Hero Icon */}
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 mb-8">
            <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          {/* Welcome Content */}
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to AI Adventure
          </h1>
          
          <p className="text-xl text-gray-600 mb-8">
            Experience interactive storytelling powered by artificial intelligence
          </p>

          {/* Features List */}
          <div className="grid md:grid-cols-2 gap-6 mb-8 text-left">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 flex items-center justify-center mt-1">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Dynamic Stories</h3>
                <p className="text-sm text-gray-600">AI creates unique narratives based on your choices</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 flex items-center justify-center mt-1">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Visual Scenes</h3>
                <p className="text-sm text-gray-600">AI-generated images bring your adventure to life</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 flex items-center justify-center mt-1">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Your API Key</h3>
                <p className="text-sm text-gray-600">Use your own OpenAI-compatible API for full control</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 flex items-center justify-center mt-1">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Auto-Save</h3>
                <p className="text-sm text-gray-600">Your progress is automatically saved as you play</p>
              </div>
            </div>
          </div>

          {/* Setup Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-center mb-3">
              <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-blue-900">Quick Setup Required</h3>
            </div>
            <p className="text-blue-800 text-sm">
              To get started, you'll need to configure your OpenAI-compatible API key. 
              This allows the AI to generate your personalized adventure stories and images.
            </p>
            <div className="mt-4 text-xs text-blue-700">
              <p><strong>Supported services:</strong> OpenAI, Azure OpenAI, and other compatible APIs</p>
              <p><strong>Privacy:</strong> Your API key is stored securely on your device only</p>
            </div>
          </div>

          {/* Get Started Button */}
          <button
            onClick={onGetStarted}
            className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-105"
          >
            <svg className="mr-3 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Get Started
          </button>

          {/* Footer Note */}
          <p className="text-xs text-gray-500 mt-6">
            By continuing, you agree to configure your own AI service credentials
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;