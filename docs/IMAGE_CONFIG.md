# Image Configuration Guide

## Overview

The AI CYOA Game now supports separate API configuration for image generation with multiple provider types, allowing you to use different endpoints, API keys, and models for text generation and image generation.

## Supported Providers

### OpenAI Compatible
- Standard OpenAI API format
- Supports automatic model discovery via `/models` endpoint
- Uses `/images/generations` endpoint
- Authorization via `Bearer` token
- Examples: OpenAI, Together AI, Replicate (OpenAI format)

### Nano-GPT
- Custom API format for nano-gpt.com
- Manual model name entry
- Uses `/api/generate-image` endpoint
- Authorization via `x-api-key` header
- Base URL: `https://nano-gpt.com`

## Configuration Options

### Basic Setup (Single Configuration)
By default, the game uses your main API configuration for both text and image generation. This works well if you're using a service like OpenAI that provides both capabilities with the same API key and endpoint.

### Advanced Setup (Separate Image Configuration)
You can enable separate image configuration to:
- Use a different API service for image generation (e.g., OpenAI for text, Nano-GPT for images)
- Use different API keys for text and images
- Use different base URLs for text and image endpoints
- Select image-specific models and providers

## How to Configure

1. **Open Settings**: Click the settings button in the game interface
2. **Configure Main API**: Set up your primary API key, base URL, and text model
3. **Enable Image Configuration**: Check the "Separate Image Generation Configuration" checkbox
4. **Configure Image Settings**:
   - **Image Provider**: Choose between "OpenAI Compatible" or "Nano-GPT"
   - **Image API Key**: Leave empty to use the main API key, or enter a different key
   - **Image Base URL**: Leave empty to use the main base URL, or enter provider-specific endpoint
   - **Image Model**: 
     - For OpenAI Compatible: Select from dropdown (auto-discovered)
     - For Nano-GPT: Manually enter model name
5. **Test Connections**: Use the test buttons to verify both text and image API connections
6. **Save Configuration**: Save your settings

## Provider-Specific Configuration

### OpenAI Compatible Setup
- **Provider**: OpenAI Compatible
- **Base URL**: `https://api.openai.com/v1` (or your provider's endpoint)
- **Model**: Select from dropdown (dall-e-2, dall-e-3, etc.)
- **API Key**: Your OpenAI-compatible API key

### Nano-GPT Setup
- **Provider**: Nano-GPT
- **Base URL**: `https://nano-gpt.com`
- **Model**: Enter manually (e.g., `flux-1.1-pro`, `stable-diffusion-xl`, `dall-e-3`)
- **API Key**: Your nano-gpt API key

## Fallback Behavior

- If image API key is not provided, the main API key is used
- If image base URL is not provided, the main base URL is used
- If image configuration is disabled, all requests use the main configuration

## Common Model Names

### OpenAI Compatible
- `dall-e-2`
- `dall-e-3`
- `stable-diffusion-xl` (if supported by provider)

### Nano-GPT
- `flux-1.1-pro`
- `stable-diffusion-xl`
- `dall-e-3`
- Custom models as provided by nano-gpt

## Example Configurations

### OpenAI Only
- Main API: OpenAI (text models like GPT-4)
- Image Config: Disabled (uses same OpenAI API for DALL-E)

### Mixed Services
- Main API: OpenAI (GPT-4 for text)
- Image Config: Nano-GPT (flux-1.1-pro for images)

### Different Keys Same Service
- Main API: OpenAI with one API key
- Image Config: OpenAI with different API key (useful for billing separation)

### Nano-GPT for Both
- Main API: Nano-GPT (text models)
- Image Config: Nano-GPT (image models with different key/model)

## Troubleshooting

### OpenAI Compatible Issues
- **Image generation fails**: Check that your image API key has image generation permissions
- **No image models found**: Verify the image base URL supports the `/models` endpoint
- **Connection errors**: Ensure the image API endpoint is correct and accessible

### Nano-GPT Issues
- **Invalid model name**: Ensure you've entered the exact model name as required by nano-gpt
- **Authentication errors**: Verify your `x-api-key` is correct
- **Endpoint errors**: Ensure base URL is `https://nano-gpt.com`

## API Compatibility

### OpenAI Compatible
- `/models` endpoint for model discovery
- `/images/generations` endpoint for image generation
- `Authorization: Bearer <token>` header
- Standard OpenAI request/response format

### Nano-GPT
- `/api/generate-image` endpoint for image generation
- `x-api-key: <key>` header
- Custom request/response format
- Manual model specification