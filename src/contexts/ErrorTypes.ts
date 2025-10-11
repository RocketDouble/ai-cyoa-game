export interface ErrorInfo {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  timestamp: Date;
  retryAction?: () => void;
  dismissible?: boolean;
  autoHide?: boolean;
}

export interface ErrorContextType {
  errors: ErrorInfo[];
  showError: (message: string, retryAction?: () => void) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
  showSuccess: (message: string) => void;
  dismissError: (id: string) => void;
  clearAllErrors: () => void;
}