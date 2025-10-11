import React from 'react';

interface LoadingIndicatorProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  inline?: boolean;
  className?: string;
}

/**
 * LoadingIndicator component provides visual feedback during operations
 * 
 * Requirements addressed:
 * - Loading indicators and status feedback for all operations
 * - Clear visual feedback during AI operations
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Loading...',
  size = 'medium',
  inline = false,
  className = ''
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'h-4 w-4';
      case 'medium':
        return 'h-6 w-6';
      case 'large':
        return 'h-8 w-8';
    }
  };

  const getTextSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'text-xs';
      case 'medium':
        return 'text-sm';
      case 'large':
        return 'text-base';
    }
  };

  if (inline) {
    return (
      <div className={`inline-flex items-center space-x-2 ${className}`}>
        <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${getSizeClasses()}`}></div>
        {message && (
          <span className={`text-gray-600 ${getTextSizeClasses()}`}>
            {message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${getSizeClasses()}`}></div>
      {message && (
        <p className={`text-gray-600 ${getTextSizeClasses()} text-center`}>
          {message}
        </p>
      )}
    </div>
  );
};

// Specialized loading indicators for specific operations
export const AILoadingIndicator: React.FC<{ operation?: string }> = ({ 
  operation = 'Generating content' 
}) => (
  <LoadingIndicator
    message={`${operation}...`}
    size="medium"
    className="py-8"
  />
);

export const ImageLoadingIndicator: React.FC = () => (
  <div className="flex items-center justify-center space-x-2 py-4">
    <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-purple-600"></div>
    <span className="text-sm text-gray-600">Generating image...</span>
  </div>
);

export const InlineLoadingIndicator: React.FC<{ message?: string }> = ({ 
  message = 'Loading' 
}) => (
  <LoadingIndicator
    message={message}
    size="small"
    inline
  />
);

export default LoadingIndicator;