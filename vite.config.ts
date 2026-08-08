import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        // Bind to localhost only. Binding to 0.0.0.0 exposes the dev server to
        // everyone on the local network, which turns Vite's dev-server file-read
        // advisories into a real risk on untrusted wifi. For device testing, opt
        // in per-run instead: `npm run dev -- --host`.
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