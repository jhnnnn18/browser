import { defineConfig } from 'vitest/config';

// End-to-end tests launch the real app. They need a built app (npm run build),
// an X11 display (use xvfb-run on a headless machine) and xdotool.
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
