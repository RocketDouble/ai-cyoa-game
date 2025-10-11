import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/ai-cyoa-game/',
  server: {
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Remove browser-specific headers that shouldn't be forwarded
            const headersToRemove = [
              'origin',
              'referer',
              'sec-fetch-site',
              'sec-fetch-mode',
              'sec-fetch-dest',
              'sec-ch-ua',
              'sec-ch-ua-mobile',
              'sec-ch-ua-platform',
              'host',
              'connection'
            ];
            
            headersToRemove.forEach(header => {
              proxyReq.removeHeader(header);
            });
            
            // Set required headers for Anthropic API
            const apiKey = req.headers['x-api-key'];
            if (apiKey) {
              proxyReq.setHeader('x-api-key', Array.isArray(apiKey) ? apiKey[0] : apiKey);
            }
            
            // Set required Anthropic headers
            proxyReq.setHeader('anthropic-version', '2023-06-01');
            proxyReq.setHeader('content-type', 'application/json');
            proxyReq.setHeader('host', 'api.anthropic.com');
          });
        }
      },
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward the Authorization header from the client request
            const auth = req.headers['authorization'];
            if (auth) {
              proxyReq.setHeader('Authorization', Array.isArray(auth) ? auth[0] : auth);
            }
          });
        }
      }
    }
  }
})
