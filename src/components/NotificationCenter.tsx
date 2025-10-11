import React from 'react';
import { useError } from '../contexts';
import type { ErrorInfo } from '../contexts';

/**
 * NotificationCenter component displays global error messages and user feedback
 * with manual retry functionality for failed operations
 * 
 * Requirements addressed:
 * - 1.3: Manual retry buttons for all AI operations
 * - 2.5: User-friendly error messages with retry options
 * - 4.5: Clear feedback when operations fail
 */
export const NotificationCenter: React.FC = () => {
  const { errors, dismissError } = useError();

  if (errors.length === 0) return null;

  const getIcon = (type: ErrorInfo['type']) => {
    switch (type) {
      case 'error':
        return (
          <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getColorClasses = (type: ErrorInfo['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getButtonClasses = (type: ErrorInfo['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-600 hover:text-red-800 hover:bg-red-100';
      case 'warning':
        return 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100';
      case 'success':
        return 'text-green-600 hover:text-green-800 hover:bg-green-100';
      case 'info':
        return 'text-blue-600 hover:text-blue-800 hover:bg-blue-100';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {errors.map((error) => (
        <div
          key={error.id}
          className={`rounded-lg border p-4 shadow-lg transition-all duration-300 ${getColorClasses(error.type)}`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {getIcon(error.type)}
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium">{error.message}</p>
              {error.timestamp && (
                <p className="text-xs opacity-75 mt-1">
                  {error.timestamp.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="ml-4 flex-shrink-0 flex space-x-1">
              {/* Retry Button */}
              {error.retryAction && (
                <button
                  onClick={() => {
                    error.retryAction!();
                    dismissError(error.id);
                  }}
                  className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded transition-colors ${getButtonClasses(error.type)}`}
                  title="Retry operation"
                >
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry
                </button>
              )}
              
              {/* Dismiss Button */}
              {error.dismissible && (
                <button
                  onClick={() => dismissError(error.id)}
                  className={`inline-flex items-center p-1 text-xs rounded transition-colors ${getButtonClasses(error.type)}`}
                  title="Dismiss notification"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationCenter;