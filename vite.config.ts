import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
