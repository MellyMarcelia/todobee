// Settings for the code checker (run with "npm run lint"). It reads the
// code and points out likely mistakes and messy bits, like a spell-checker
// for code.
import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default defineConfig(
  // Skip downloaded tools and built files - only check our own code.
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  // Start from the recommended rules for TypeScript and for Vue.
  tseslint.configs.recommended,
  eslintPluginVue.configs['flat/recommended'],
  // Teach the checker how to read .vue files that contain TypeScript.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser
      }
    }
  },
  {
    files: ['**/*.{ts,mts,tsx,vue}'],
    rules: {
      // Don't insist every screen setting has a default value.
      'vue/require-default-prop': 'off',
      // Allow one-word names like "Bee.vue" or "Laptop.vue".
      'vue/multi-word-component-names': 'off',
      // Every .vue file's script must be written in TypeScript.
      'vue/block-lang': [
        'error',
        {
          script: {
            lang: 'ts'
          }
        }
      ]
    }
  },
  // Turn off any rules about spacing and layout - Prettier handles those.
  eslintConfigPrettier
)
