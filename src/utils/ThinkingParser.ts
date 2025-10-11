/**
 * Utility for parsing and extracting thinking content from AI responses
 */
export class ThinkingParser {
  /**
   * Extract thinking content and clean response text
   * Returns both the thinking content and the cleaned response
   */
  static parseThinkingResponse(response: string): {
    thinkingContent: string;
    cleanedResponse: string;
    hasThinking: boolean;
  } {
    // Look for complete thinking tags (case insensitive)
    const completeThinkingRegex = /<think>(.*?)<\/think>/is;
    const completeMatch = response.match(completeThinkingRegex);

    if (completeMatch) {
      const thinkingContent = completeMatch[1].trim();
      // Remove the entire thinking block from the response
      const cleanedResponse = response.replace(completeThinkingRegex, '').trim();
      
      return {
        thinkingContent,
        cleanedResponse,
        hasThinking: true
      };
    }

    // Check for incomplete thinking tags (opening tag but no closing tag)
    const incompleteThinkingRegex = /<think>(.*?)$/is;
    const incompleteMatch = response.match(incompleteThinkingRegex);

    if (incompleteMatch) {
      const thinkingContent = incompleteMatch[1].trim();
      // Get everything before <think> as the cleaned response
      const beforeThink = response.substring(0, response.indexOf('<think>')).trim();
      
      // If there's content before <think>, use it; otherwise, try to extract story from thinking
      let cleanedResponse = beforeThink;
      
      if (!cleanedResponse && thinkingContent) {
        // Try to extract any story content that might be at the end of the thinking
        const storyInThinking = this.extractStoryFromThinking(thinkingContent);
        if (storyInThinking) {
          cleanedResponse = storyInThinking;
        }
      }
      
      return {
        thinkingContent,
        cleanedResponse,
        hasThinking: true
      };
    }

    // Check for orphaned closing tag (closing tag but no opening tag)
    if (response.includes('</think>')) {
      // Remove the orphaned closing tag
      const cleanedResponse = response.replace(/<\/think>/gi, '').trim();
      
      return {
        thinkingContent: '',
        cleanedResponse,
        hasThinking: false
      };
    }

    // No thinking content found
    return {
      thinkingContent: '',
      cleanedResponse: response,
      hasThinking: false
    };
  }

  /**
   * Process streaming chunks to handle thinking content
   * This maintains state across chunks to properly handle thinking tags that span multiple chunks
   */
  static createStreamingProcessor() {
    let buffer = '';
    let thinkingContent = '';
    let isInThinkingBlock = false;
    let thinkingComplete = false;

    return {
      processChunk: (chunk: string): {
        displayChunk: string;
        thinkingChunk: string;
        thinkingComplete: boolean;
        fullThinkingContent: string;
      } => {
        buffer += chunk;
        let displayChunk = '';
        let thinkingChunk = '';

        // If we haven't completed thinking processing yet
        if (!thinkingComplete) {
          // Check if we're entering a thinking block
          if (!isInThinkingBlock && buffer.includes('<think>')) {
            const thinkStart = buffer.indexOf('<think>');
            // Add any content before <think> to display
            if (thinkStart > 0) {
              displayChunk = buffer.substring(0, thinkStart);
              buffer = buffer.substring(thinkStart);
            }
            isInThinkingBlock = true;
            buffer = buffer.replace('<think>', '');
          }

          // If we're in a thinking block
          if (isInThinkingBlock) {
            // Check if we're exiting the thinking block
            if (buffer.includes('</think>')) {
              const thinkEnd = buffer.indexOf('</think>');
              const thinkingPart = buffer.substring(0, thinkEnd);
              thinkingContent += thinkingPart;
              thinkingChunk = thinkingPart;
              
              // Everything after </think> goes to display
              buffer = buffer.substring(thinkEnd + 8); // 8 = length of '</think>'
              displayChunk = buffer;
              buffer = '';
              
              isInThinkingBlock = false;
              thinkingComplete = true;
            } else {
              // Still in thinking block, accumulate thinking content
              thinkingContent += buffer;
              thinkingChunk = buffer;
              buffer = '';
            }
          } else if (thinkingComplete) {
            // Thinking is complete, all new content goes to display
            displayChunk = buffer;
            buffer = '';
          } else {
            // No thinking block detected yet, add to display
            displayChunk = buffer;
            buffer = '';
          }
        } else {
          // Thinking processing is complete, all content goes to display
          displayChunk = chunk;
        }

        return {
          displayChunk,
          thinkingChunk,
          thinkingComplete,
          fullThinkingContent: thinkingContent
        };
      },

      getState: () => ({
        thinkingContent,
        isInThinkingBlock,
        thinkingComplete
      }),

      reset: () => {
        buffer = '';
        thinkingContent = '';
        isInThinkingBlock = false;
        thinkingComplete = false;
      }
    };
  }

  /**
   * Try to extract story content from incomplete thinking content
   * This handles cases where the AI response was truncated mid-thinking
   */
  private static extractStoryFromThinking(thinkingContent: string): string {
    // Look for patterns that suggest the AI started writing the actual story
    const storyPatterns = [
      /STORY:\s*(.*?)$/is,
      /(?:^|\n)\s*You\s+(?:are|find|see|hear|feel|walk|run|stand|sit|look)\s+.*$/im,
      /(?:^|\n)\s*The\s+.*$/im,
      /(?:^|\n)\s*A\s+.*$/im,
      /(?:^|\n)\s*As\s+you\s+.*$/im,
      /(?:^|\n)\s*Your\s+.*$/im
    ];

    for (const pattern of storyPatterns) {
      const match = thinkingContent.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        if (extracted.length > 50) {
          return extracted;
        }
      } else if (match && match[0]) {
        const extracted = match[0].trim();
        if (extracted.length > 50) {
          return extracted;
        }
      }
    }

    // Look for the last few sentences that might be story content
    const sentences = thinkingContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length > 0) {
      const lastSentences = sentences.slice(-2).join('. ').trim();
      if (lastSentences.length > 50 && 
          (lastSentences.includes('You ') || lastSentences.includes('The ') || lastSentences.includes('A '))) {
        return lastSentences + '.';
      }
    }

    return '';
  }

  /**
   * Validate that thinking tags are properly formatted
   */
  static validateThinkingTags(text: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Count opening and closing tags
    const openTags = (text.match(/<think>/gi) || []).length;
    const closeTags = (text.match(/<\/think>/gi) || []).length;
    
    if (openTags !== closeTags) {
      errors.push(`Mismatched thinking tags: ${openTags} opening, ${closeTags} closing`);
    }
    
    // Check for nested thinking tags
    const thinkingBlocks = text.match(/<think>.*?<\/think>/gis) || [];
    for (const block of thinkingBlocks) {
      const innerThinkTags = (block.match(/<think>/gi) || []).length;
      if (innerThinkTags > 1) {
        errors.push('Nested thinking tags detected');
        break;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean up malformed thinking tags
   */
  static cleanupMalformedTags(text: string): string {
    // Remove any orphaned opening tags without closing tags
    let cleaned = text;
    
    // Find all <think> tags and their positions
    const openMatches = [...cleaned.matchAll(/<think>/gi)];
    const closeMatches = [...cleaned.matchAll(/<\/think>/gi)];
    
    // If we have unmatched opening tags, remove them
    if (openMatches.length > closeMatches.length) {
      // Remove excess opening tags from the end
      const excessCount = openMatches.length - closeMatches.length;
      for (let i = 0; i < excessCount; i++) {
        const lastOpenIndex = cleaned.lastIndexOf('<think>');
        if (lastOpenIndex !== -1) {
          cleaned = cleaned.substring(0, lastOpenIndex) + cleaned.substring(lastOpenIndex + 7);
        }
      }
    }
    
    // If we have unmatched closing tags, remove them
    if (closeMatches.length > openMatches.length) {
      const excessCount = closeMatches.length - openMatches.length;
      for (let i = 0; i < excessCount; i++) {
        const firstCloseIndex = cleaned.indexOf('</think>');
        if (firstCloseIndex !== -1) {
          cleaned = cleaned.substring(0, firstCloseIndex) + cleaned.substring(firstCloseIndex + 8);
        }
      }
    }
    
    return cleaned;
  }
}