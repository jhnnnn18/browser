import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';

// electron-vite builds three separate bundles into out/:
//   main     -> out/main/index.js      (Node, runs the app)
//   preload  -> out/preload/index.js   (the bridge)
//   renderer -> out/renderer/          (the toolbar UI, served by Vite in dev)
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
});
