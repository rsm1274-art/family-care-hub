import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // happy-dom supplies localStorage; Web Crypto comes from Node's globalThis.
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
