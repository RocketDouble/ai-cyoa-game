import { describe, it, expect, vi } from 'vitest';
import { CustomStoryService } from '../CustomStoryService';
import type { AIConfig } from '../../types';

describe('CustomStoryService - Image Generation Integration', () => {
  const mockConfig: AIConfig = {
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
    availableModels: ['gpt-4'],
    enableImageGeneration: true,
    imageConfig: {
      provider: 'openai',
      apiKey: 'test-image-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'dall-e-3'
    }
  };

  it('should include scene description when image generation is enabled', async () => {
    // Mock the AI service response
    const mockResponse = `STORY: You step into the mysterious forest, the twilight casting long shadows through the ancient trees. The air is thick with the scent of moss and earth.

SCENE: A dark forest at twilight with ancient trees and long shadows`;

    // Mock fetch to return the story response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: mockResponse } }]
      })
    });

    const result = await CustomStoryService.generateCustomInitialStory(
      mockConfig,
      'You find yourself in a mysterious forest'
    );

    expect(result.sceneDescription).toBeDefined();
    expect(result.sceneDescription.length).toBeGreaterThan(0);
    expect(result.sceneDescription).not.toBe('A mysterious scene unfolds');
  });

  it('should use generic scene description when image generation is disabled', async () => {
    const configWithoutImages: AIConfig = {
      ...mockConfig,
      enableImageGeneration: false
    };

    const mockResponse = `STORY: You step into the mysterious forest, the twilight casting long shadows through the ancient trees.`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: mockResponse } }]
      })
    });

    const result = await CustomStoryService.generateCustomInitialStory(
      configWithoutImages,
      'You find yourself in a mysterious forest'
    );

    expect(result.sceneDescription).toBe('A mysterious scene unfolds');
  });

  it('should include scene description in story continuation', async () => {
    const mockResponse = `STORY: You carefully approach the glowing object. As you get closer, you realize it's an ancient artifact pulsing with magical energy.

SCENE: A glowing magical artifact in a forest clearing, pulsing with blue energy`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: mockResponse } }]
      })
    });

    const context = {
      storyHistory: [],
      choiceHistory: [],
      currentScene: 'A mysterious forest at twilight'
    };

    const result = await CustomStoryService.continueCustomStory(
      mockConfig,
      'I approach the glowing object',
      context
    );

    expect(result.sceneDescription).toBeDefined();
    expect(result.sceneDescription).toContain('artifact');
  });

  it('should handle missing scene description gracefully', async () => {
    const mockResponse = `STORY: You step into the mysterious forest, the twilight casting long shadows through the ancient trees.`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: mockResponse } }]
      })
    });

    const result = await CustomStoryService.generateCustomInitialStory(
      mockConfig,
      'You find yourself in a mysterious forest'
    );

    // Should use generic placeholder when scene is missing
    expect(result.sceneDescription).toBe('A mysterious scene unfolds');
  });
});
