import React, { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ErrorInfo, ErrorContextType } from './ErrorTypes';
import { ErrorContext } from './ErrorContextDefinition';

interface ErrorProviderProps {
  children: ReactNode;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);

  const generateId = useCallback(() => {
    return `error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  const addError = useCallback((
    message: string,
    type: ErrorInfo['type'],
    retryAction?: () => void,
    autoHide = true
  ) => {
    const error: ErrorInfo = {
      id: generateId(),
      message,
      type,
      timestamp: new Date(),
      retryAction,
      dismissible: true,
      autoHide
    };

    setErrors(prev => [...prev, error]);

    // Auto-hide success, info, and warning messages after 5 seconds
    if (autoHide && (type === 'success' || type === 'info' || type === 'warning')) {
      setTimeout(() => {
        setErrors(prev => prev.filter(e => e.id !== error.id));
      }, 5000);
    }

    return error.id;
  }, [generateId]);

  const showError = useCallback((message: string, retryAction?: () => void) => {
    return addError(message, 'error', retryAction, false);
  }, [addError]);

  const showWarning = useCallback((message: string) => {
    return addError(message, 'warning', undefined, true);
  }, [addError]);

  const showInfo = useCallback((message: string) => {
    return addError(message, 'info', undefined, true);
  }, [addError]);

  const showSuccess = useCallback((message: string) => {
    return addError(message, 'success', undefined, true);
  }, [addError]);

  const dismissError = useCallback((id: string) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const value: ErrorContextType = {
    errors,
    showError,
    showWarning,
    showInfo,
    showSuccess,
    dismissError,
    clearAllErrors
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

export default ErrorProvider;