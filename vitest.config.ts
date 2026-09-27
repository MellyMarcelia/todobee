import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Minimal Vitest config for renderer component tests. Mirrors the
// '@renderer' alias from electron.vite.config.ts so tests can import
// screens/components the same way the app does.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'jsdom'
  }
})
