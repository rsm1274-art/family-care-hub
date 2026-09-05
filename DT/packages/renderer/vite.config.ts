import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // We keep loadEnv just in case you use other environment variables
    const env = loadEnv(mode, '.', ''); 
    return {
      server: {
        port: Number(process.env.PORT) || 3000,
        host: '0.0.0.0',
      },
      // Relative base so the build works from file:// inside Electron.
      base: './',
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