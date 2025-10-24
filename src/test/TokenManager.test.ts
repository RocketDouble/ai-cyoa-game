import { TokenManager } from '../utils/TokenManager';
import type { StorySegment, Choice } from '../types';

describe('TokenManager Context Truncation Fix', () => {
  // Helper to create test story segments
  const createSegment = (id: string, textLength: number): StorySegment => ({
    id,
    text: 'A'.repeat(textLength), // Create text of specific length
    sceneDescription: 'Test scene',
    choices: []
  });

  // Helper to create test choices
  const createChoice = (id: string, text: string): Choice => ({
    id,
    text
  });

  test('should include more segments when they fit within token budget', () => {
    // Create 5 segments with moderate length (should all fit)
    const segments: StorySegment[] = [
      createSegment('1', 200),
      createSegment('2', 200),
      createSegment('3', 200),
      createSegment('4', 200),
      createSegment('5', 200)
    ];

    const choices: Choice[] = [
      createChoice('1', 'Choice 1'),
      createChoice('2', 'Choice 2'),
      createChoice('3', 'Choice 3'),
      createChoice('4', 'Choice 4')
    ];

    const result = TokenManager.buildEnhancedContext(
      segments,
      choices,
      'Current scene',
      3000 // Generous token budget
    );

    // Should include all or most segments since they're small
    expect(result.segmentsIncluded).toBeGreaterThan(3);
    expect(result.choicesIncluded).toBeGreaterThan(3);
  });

  test('should not pre-truncate segments to 300 characters when budget allows', () => {
    // Create one segment with 800 characters
    const longText = 'This is a long story segment that should not be truncated to 300 characters when there is sufficient token budget available. '.repeat(5);
    const segments: StorySegment[] = [
      {
        id: '1',
        text: longText,
        sceneDescription: 'Test scene',
        choices: []
      }
    ];

    const choices: Choice[] = [
      createChoice('1', 'Test choice')
    ];

    const result = TokenManager.buildEnhancedContext(
      segments,
      choices,
      'Current scene',
      3000 // Generous token budget
    );

    // The previous segment should not be truncated to 300 chars if budget allows
    expect(result.previousSegment).toBe(longText);
    expect(result.previousSegment!.length).toBeGreaterThan(300);
  });

  test('should provide debug information about context building', () => {
    const segments: StorySegment[] = [
      createSegment('1', 500),
      createSegment('2', 500),
      createSegment('3', 500)
    ];

    const choices: Choice[] = [
      createChoice('1', 'Choice 1'),
      createChoice('2', 'Choice 2')
    ];

    const debug = TokenManager.debugContextBuilding(
      segments,
      choices,
      'Current scene',
      2000
    );

    expect(debug.totalSegments).toBe(3);
    expect(debug.totalChoices).toBe(2);
    expect(debug.segmentsIncluded).toBeGreaterThan(0);
    expect(debug.choicesIncluded).toBeGreaterThan(0);
    expect(debug.contextTokens).toBeGreaterThan(0);
    expect(debug.utilizationPercent).toBeGreaterThan(0);
  });

  test('should handle empty history gracefully', () => {
    const result = TokenManager.buildEnhancedContext(
      [],
      [],
      'Current scene',
      1000
    );

    expect(result.segmentsIncluded).toBe(0);
    expect(result.choicesIncluded).toBe(0);
    expect(result.previousSegment).toBeNull();
    expect(result.previousAction).toBeNull();
    expect(result.contextText).toBe('');
  });
});