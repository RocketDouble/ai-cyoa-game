import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch globally for tests
global.fetch = vi.fn();

// Mock AbortSignal.timeout for older environments
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (delay: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), delay);
    return controller.signal;
  };
}