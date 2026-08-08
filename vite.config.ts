import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      // THIS IS THE CORRECT SETTING FOR GITHUB PAGES
      base: '/family-care-hub/',
      plugins: [react()],
      define: {
        // CLEANUP: Removed unused GEMINI_API_KEY definitions
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});