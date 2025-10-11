/**
 * Validation utilities for custom scenario mode
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates custom scene description input
 * Requirements: 1.5, 1.6
 * 
 * @param sceneDescription - The scene description to validate
 * @returns ValidationResult with isValid flag and optional error message
 */
export function validateCustomScene(sceneDescription: string): ValidationResult {
  const trimmed = sceneDescription.trim();
  
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Please enter a scene description'
    };
  }
  
  if (trimmed.length < 20) {
    return {
      isValid: false,
      error: 'Scene description must be at least 20 characters'
    };
  }
  
  if (trimmed.length > 300) {
    return {
      isValid: false,
      error: 'Scene description must not exceed 300 characters'
    };
  }
  
  return { isValid: true };
}

/**
 * Validates custom action input
 * Requirements: 2.4, 2.5, 8.1, 8.2, 8.3
 * 
 * @param actionText - The action text to validate
 * @returns ValidationResult with isValid flag and optional error message
 */
export function validateCustomAction(actionText: string): ValidationResult {
  const trimmed = actionText.trim();
  
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Please enter an action'
    };
  }
  
  if (trimmed.length < 5) {
    return {
      isValid: false,
      error: 'Action must be at least 5 characters'
    };
  }
  
  if (trimmed.length > 200) {
    return {
      isValid: false,
      error: 'Action must not exceed 200 characters'
    };
  }
  
  return { isValid: true };
}

/**
 * Generates error message for custom scene validation
 * Requirements: 8.4, 8.5, 8.6
 * 
 * @param sceneDescription - The scene description to validate
 * @returns Error message string or null if valid
 */
export function getCustomSceneError(sceneDescription: string): string | null {
  const result = validateCustomScene(sceneDescription);
  return result.error || null;
}

/**
 * Generates error message for custom action validation
 * Requirements: 8.4, 8.5, 8.6
 * 
 * @param actionText - The action text to validate
 * @returns Error message string or null if valid
 */
export function getCustomActionError(actionText: string): string | null {
  const result = validateCustomAction(actionText);
  return result.error || null;
}

/**
 * Checks if a string contains only whitespace
 * 
 * @param text - The text to check
 * @returns true if the text is empty or contains only whitespace
 */
export function isWhitespaceOnly(text: string): boolean {
  return text.trim().length === 0;
}
