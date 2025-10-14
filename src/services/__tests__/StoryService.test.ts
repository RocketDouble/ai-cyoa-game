import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoryService } from '../StoryService';
import { AIServiceError } from '../AIService';
import type { AIConfig, StoryContext, Choice, StorySegment } from '../../types';

// Mock AIService
vi.mock('../AIService', () => ({
  AIService: {
    chatCompletionWithRetry: vi.fn(),
    createSystemMessage: vi.fn((content: string) => ({ role: 'system', content })),
    createUserMessage: vi.fn((content: string) => ({ role: 'user', content })),
  },
  AIServiceError: class extends Error {
    public code: string;
    public retryable: boolean;
    
    constructor(message: string, code: string, retryable: boolean = true) {
      super(message);
      this.name = 'AIServiceError';
      this.code = code;
      this.retryable = retryable;
    }
  }
}));

import { AIService } from '../AIService';
const mockAIService = vi.mocked(AIService);

describe('StoryService', () => {
  const mockConfig: AIConfig = {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.test.com/v1',
    model: 'gpt-3.5-turbo'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateInitialStory', () => {
    it('should generate initial story successfully', async () => {
      const mockResponse = `STORY: You find yourself standing at the edge of a mysterious forest. The ancient trees tower above you, their branches creating a canopy so thick that only scattered beams of sunlight penetrate to the forest floor. A worn path winds into the darkness ahead, while strange sounds echo from within the depths.

SCENE: A person standing at the edge of a dark, mysterious forest with towering ancient trees and a winding path disappearing into shadows`;

      mockAIService.chatCompletionWithRetry.mockResolvedValueOnce({ response: mockResponse });

      const result = await StoryService.generateInitialStory(mockConfig);

      expect(result).toMatchObject({
        id: expect.any(String),
        text: expect.stringContaining('You find yourself standing at the edge'),
        sceneDescription: expect.stringContaining('A person standing at the edge'),
        choices: []
      });

      expect(mockAIService.chatCompletionWithRetry).toHaveBeenCalledWith(
        mockConfig,
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' })
        ]),
        {
          temperature: 0.8,
          maxTokens: 2048
        }
      );
    });

    it('should throw AIServiceError when AI service fails', async () => {
      const aiError = new AIServiceError('API Error', 'API_ERROR');
      mockAIService.chatCompletionWithRetry.mockRejectedValueOnce(aiError);

      await expect(StoryService.generateInitialStory(mockConfig))
        .rejects.toThrow(AIServiceError);
    });

    it('should wrap non-AIServiceError in AIServiceError', async () => {
      mockAIService.chatCompletionWithRetry.mockRejectedValueOnce(new Error('Generic error'));

      const error = await StoryService.generateInitialStory(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.message).toContain('Failed to generate initial story');
    });

    it('should handle malformed story response', async () => {
      const malformedResponse = 'This is not a properly formatted response';
      mockAIService.chatCompletionWithRetry.mockResolvedValueOnce({ response: malformedResponse });

      const error = await StoryService.generateInitialStory(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('PARSE_ERROR');
    });

    it('should handle story response without scene description', async () => {
      const responseWithoutScene = 'STORY: A story without scene description that is long enough to pass validation checks and contains sufficient content for testing purposes';
      mockAIService.chatCompletionWithRetry.mockResolvedValueOnce({ response: responseWithoutScene });

      const result = await StoryService.generateInitialStory(mockConfig);

      expect(result.sceneDescription).toBe('A mysterious scene unfolds');
    });

    it('should reject story that is too short', async () => {
      const shortResponse = 'STORY: Short\nSCENE: Scene';
      mockAIService.chatCompletionWithRetry.mockResolvedValueOnce({ response: shortResponse });

      const error = await StoryService.generateInitialStory(mockConfig)
        .catch(e => e);

      expect(error).toBeInstanceOf(AIServiceError);
      expect(error.code).toBe('PARSE_ERROR');
      expect(error.message).toContain('Story content too short');
    });
  });

  describe('continueStory', () => {
    const mockChoice: Choice = {
      id: 'choice-1',
      text: 'Enter the forest'
    };

    const mockContext: StoryContext = {
      storyHistory: [
        {
          id: 'story-1',
          text: 'Previous story segment',
          sceneDescription: 'Previous scene',
          choices: []
        }
      ],
      choiceHistory: [
        {
          id: 'prev-choice',
          text: 'Previous choice'
        }
      ],
      currentScene: 'At the forest edge'
    };

    it('should continue story successfully', async () => {
      const mockStoryResponse = `STORY: You step into the forest, and immediately the temperature drops. The path beneath your feet is soft with fallen leaves, and you can hear the distant sound of running water.

SCENE: A person walking on a leaf-covered forest path with dappled sunlight`;

      const mockChoicesResponse = `1. Follow the sound of water to find a stream
2. Examine the strange markings on nearby trees
3. Call out to see if anyone responds
4. Turn back while you still can`;

      mockAIService.chatCompletionWithRetry
        .mockResolvedValueOnce({ response: mockStoryResponse })
        .mockResolvedValueOnce({ response: mockChoicesResponse });

      const result = await StoryService.continueStory(mockConfig, mockChoice, mockContext);

      expect(result).toMatchObject({
        id: expect.any(String),
        text: expect.stringContaining('You step into the forest'),
        sceneDescription: expect.stringContaining('A person walking on a leaf-covered'),
        choices: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            text: expect.stringContaining('Follow the sound of water')
          })
        ])
      });

      expect(result.choices).toHaveLength(4);
    });

    it('should handle AI service errors during story continuation', async () => {
      const aiError = new AIServiceError('Network error', 'NETWORK_ERROR');
      mockAIService.chatCompletionWithRetry.mockRejectedValueOnce(aiError);

      await expect(StoryService.continueStory(mockConfig, mockChoice, mockContext))
        .rejects.toThrow(AIServiceError);
    });

    it('should handle AI service errors during choice generation', async () => {
      const mockStoryResponse = 'STORY: Story text that is long enough to pass validation\nSCENE: Scene description';
      mockAIService.chatCompletionWithRetry
        .mockResolvedValueOnce({ response: mockStoryResponse })
        .mockRejectedValueOnce(new AIServiceError('Choice generation failed', 'API_ERROR'));

      await expect(StoryService.continueStory(mockConfig, mockChoice, mockContext))
        .rejects.toThrow(AIServiceError);
    });
  });



  describe('utility functions', () => {
    describe('validateStoryContext', () => {
      it('should validate correct story context', () => {
        const validContext: StoryContext = {
          storyHistory: [],
          choiceHistory: [],
          currentScene: 'A scene'
        };

        expect(StoryService.validateStoryContext(validContext)).toBe(true);
      });

      it('should reject invalid story context', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(StoryService.validateStoryContext(null as any)).toBeFalsy();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(StoryService.validateStoryContext(undefined as any)).toBeFalsy();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(StoryService.validateStoryContext({} as any)).toBeFalsy();
        expect(StoryService.validateStoryContext({
          storyHistory: 'not an array',
          choiceHistory: [],
          currentScene: 'scene'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)).toBeFalsy();
        expect(StoryService.validateStoryContext({
          storyHistory: [],
          choiceHistory: [],
          currentScene: ''
        })).toBeFalsy();
      });
    });

    describe('createStoryContext', () => {
      it('should create story context with copies of arrays', () => {
        const storyHistory: StorySegment[] = [
          { id: '1', text: 'Story', sceneDescription: 'Scene', choices: [] }
        ];
        const choiceHistory: Choice[] = [
          { id: '1', text: 'Choice' }
        ];

        const context = StoryService.createStoryContext(
          storyHistory,
          choiceHistory,
          'Current scene'
        );

        expect(context.storyHistory).toEqual(storyHistory);
        expect(context.choiceHistory).toEqual(choiceHistory);
        expect(context.currentScene).toBe('Current scene');

        // Verify arrays are copied, not referenced
        expect(context.storyHistory).not.toBe(storyHistory);
        expect(context.choiceHistory).not.toBe(choiceHistory);
      });
    });


  });
});