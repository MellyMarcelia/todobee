import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Settings for the automatic tests (run with "npm test").
export default defineConfig({
  // Lets the tests read our .vue screen files.
  plugins: [vue()],
  // The same "@renderer/..." shortcut as in electron.vite.config.ts, so
  // tests can find files the same way the app does.
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    // Run the tests inside a pretend browser, so screens can be tested
    // without opening a real window.
    environment: 'jsdom'
  }
})
