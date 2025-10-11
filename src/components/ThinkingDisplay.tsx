import React, { useState, useEffect, useRef } from 'react';
import { TokenManager } from '../utils/TokenManager';

interface ThinkingDisplayProps {
  thinkingContent: string;
  className?: string;
  isStreaming?: boolean;
}

/**
 * ThinkingDisplay component renders AI thinking content in a collapsible dropdown
 * This allows users to see the model's reasoning process without cluttering the main display
 */
export const ThinkingDisplay: React.FC<ThinkingDisplayProps> = ({
  thinkingContent,
  className = '',
  isStreaming = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousContentLength = useRef(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const autoScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollVelocityRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Handle user scrolling detection
  const handleScroll = () => {
    if (!scrollContainerRef.current || !isStreaming) return;

    // Ignore programmatic scrolls completely
    if (isProgrammaticScrollRef.current) {
      return;
    }

    const container = scrollContainerRef.current;
    const currentScrollTop = container.scrollTop;
    const currentTime = Date.now();
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10; // 10px tolerance

    // Calculate scroll velocity to detect intentional user scrolling
    const timeDelta = currentTime - lastScrollTimeRef.current;
    const scrollDelta = currentScrollTop - lastScrollTopRef.current;

    if (timeDelta > 0) {
      scrollVelocityRef.current = Math.abs(scrollDelta) / timeDelta;
    }

    // Detect if user manually scrolled up with sufficient velocity (not just natural scroll from content addition)
    const scrolledUp = scrollDelta < -5 && scrollVelocityRef.current > 0.1; // Threshold for intentional scroll

    if (scrolledUp && !isAtBottom) {
      // User intentionally scrolled up
      setIsUserScrolling(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Reset user scrolling flag after 3 seconds of no scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        // Double-check if still not at bottom before resetting
        if (scrollContainerRef.current) {
          const stillNotAtBottom = scrollContainerRef.current.scrollHeight - scrollContainerRef.current.scrollTop > scrollContainerRef.current.clientHeight + 10;
          if (!stillNotAtBottom) {
            setIsUserScrolling(false);
          }
        }
      }, 3000);
    } else if (isAtBottom && !isProgrammaticScrollRef.current) {
      // User scrolled back to bottom naturally
      setIsUserScrolling(false);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    }

    // Update last scroll position and time
    lastScrollTopRef.current = currentScrollTop;
    lastScrollTimeRef.current = currentTime;
  };

  // Auto-scroll when new thinking content is added and the component is expanded
  useEffect(() => {
    if (isExpanded && isStreaming && scrollContainerRef.current && !isUserScrolling) {
      const currentLength = thinkingContent.length;

      // Only scroll if content has actually increased (new content added)
      if (currentLength > previousContentLength.current) {
        const container = scrollContainerRef.current;

        // Check if we're already near the bottom (within 100px)
        const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

        if (isNearBottom && isVisible) {
          // Mark as programmatic scroll
          isProgrammaticScrollRef.current = true;

          // Use requestAnimationFrame for smooth, immediate scrolling
          requestAnimationFrame(() => {
            if (container && !isUserScrolling && isStreaming) {
              container.scrollTop = container.scrollHeight;
            }

            // Reset programmatic scroll flag quickly
            setTimeout(() => {
              isProgrammaticScrollRef.current = false;
            }, 16);
          });
        }
      }

      previousContentLength.current = currentLength;
    }
  }, [thinkingContent, isExpanded, isStreaming, isUserScrolling, isVisible]);

  // Set up MutationObserver for immediate DOM change detection during streaming
  useEffect(() => {
    if (isExpanded && isStreaming && scrollContainerRef.current && !isUserScrolling) {
      const container = scrollContainerRef.current;
      const preElement = container.querySelector('pre');

      if (preElement) {
        // Create mutation observer to watch for text changes
        mutationObserverRef.current = new MutationObserver(() => {
          if (!isUserScrolling && isStreaming && container) {
            // Check if we're near the bottom
            const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

            if (isNearBottom && isVisible) {
              // Mark as programmatic scroll
              isProgrammaticScrollRef.current = true;

              // Immediate scroll to bottom
              container.scrollTop = container.scrollHeight;

              // Reset flag quickly
              setTimeout(() => {
                isProgrammaticScrollRef.current = false;
              }, 10);
            }
          }
        });

        // Observe text content changes
        mutationObserverRef.current.observe(preElement, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    } else {
      // Clean up observer when not streaming
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
    }

    // Cleanup on unmount or when conditions change
    return () => {
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
    };
  }, [isExpanded, isStreaming, isUserScrolling, isVisible]);

  // Set up intersection observer to detect if the thinking display is visible
  useEffect(() => {
    if (scrollContainerRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsVisible(entry.isIntersecting);
        },
        { threshold: 0.1 }
      );

      observer.observe(scrollContainerRef.current);

      return () => {
        observer.disconnect();
      };
    }
  }, [isExpanded]);

  // Reset previous content length and user scrolling when thinking starts fresh
  useEffect(() => {
    if (!isStreaming) {
      previousContentLength.current = 0;
      setIsUserScrolling(false);
      isProgrammaticScrollRef.current = false;
      lastScrollTopRef.current = 0;
      scrollVelocityRef.current = 0;
      lastScrollTimeRef.current = 0;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
        autoScrollTimeoutRef.current = null;
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
    }
  }, [isStreaming]);

  // Cleanup timeouts and observers on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
      }
    };
  }, []);

  if (!thinkingContent.trim()) {
    return null;
  }

  return (
    <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 text-left flex items-center justify-between text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-blue-600 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span className="text-sm font-medium">AI Thinking Process</span>
          <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
            ~{TokenManager.estimateTokens(thinkingContent)} tokens
          </span>
        </div>
        <svg
          className={`h-4 w-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="relative">
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 p-3 max-h-64 overflow-y-auto scroll-smooth"
            >
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                {thinkingContent}
                {isStreaming && (
                  <span className="inline-block w-1 h-3 bg-blue-500 dark:bg-blue-400 ml-1 animate-pulse"></span>
                )}
              </pre>
            </div>

            {/* Scroll to bottom button - only show when user has intentionally scrolled up */}
            {isUserScrolling && isStreaming && scrollContainerRef.current &&
              (scrollContainerRef.current.scrollHeight - scrollContainerRef.current.scrollTop > scrollContainerRef.current.clientHeight + 20) && (
                <button
                  onClick={() => {
                    if (scrollContainerRef.current) {
                      // Mark as programmatic scroll
                      isProgrammaticScrollRef.current = true;

                      // Use instant scroll for immediate response
                      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;

                      // Reset user scrolling state immediately
                      setIsUserScrolling(false);

                      // Clear any pending timeouts
                      if (scrollTimeoutRef.current) {
                        clearTimeout(scrollTimeoutRef.current);
                        scrollTimeoutRef.current = null;
                      }

                      // Reset programmatic scroll flag quickly
                      setTimeout(() => {
                        isProgrammaticScrollRef.current = false;
                      }, 50);
                    }
                  }}
                  className="absolute bottom-2 right-2 bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow-lg transition-colors flex items-center gap-1"
                  title="Scroll to bottom"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span>Follow</span>
                </button>
              )}
          </div>
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center justify-between">
            <span>This shows the AI's internal reasoning process before generating the story response.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingDisplay;