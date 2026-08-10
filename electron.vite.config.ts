import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

/** İki uygulama tek pakette:
 *  - CONSUL            → renderer/index.html      + preload/index.ts
 *  - CONSUL Developer  → renderer/developer.html  + preload/developer.ts
 *  Main süreç hangi modda açıldığını argv'den okur (src/main/app/mode.ts). */
export default defineConfig({
  main: {
    build: {
      // Native/Node-only modüller asla bundle'a girmez
      rollupOptions: { external: ['@lydell/node-pty', 'electron-updater'] },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          developer: resolve(__dirname, 'src/preload/developer.ts'),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          developer: resolve(__dirname, 'src/renderer/developer.html'),
        },
      },
    },
  },
})
