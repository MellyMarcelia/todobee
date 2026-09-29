// Settings for the tool that builds the app (electron-vite). It builds the
// app's three parts: the behind-the-scenes part (main), the messenger
// (preload), and the screens (renderer).
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // The behind-the-scenes part and the messenger use the standard settings.
  main: {},
  preload: {},
  renderer: {
    resolve: {
      // A shortcut: "@renderer/..." means "src/renderer/src/...", so file
      // paths don't need lots of "../../".
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    // Teaches the builder how to read our .vue screen files.
    plugins: [vue()]
  }
})
