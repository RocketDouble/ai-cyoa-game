import { createContext } from 'react';
import type { ErrorContextType } from './ErrorTypes';

export const ErrorContext = createContext<ErrorContextType | undefined>(undefined);