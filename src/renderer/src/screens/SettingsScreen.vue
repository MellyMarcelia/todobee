<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { VaultStatus } from '../../../shared/types'

defineEmits<{ back: [] }>()

// `null` = still loading, so the template can avoid flashing a "no vault
// chosen" warning for a split second before the real status arrives.
const vaultStatus = ref<VaultStatus | null>(null)
const loadError = ref<string | null>(null)

async function loadVaultStatus(): Promise<void> {
  loadError.value = null
  try {
    vaultStatus.value = await window.api.getVaultStatus()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to load vault status:', error)
  }
}

onMounted(loadVaultStatus)

async function chooseFolder(): Promise<void> {
  loadError.value = null
  try {
    // Resolves to null if the user cancels the native picker — in that
    // case we simply leave the current status as it was.
    const result = await window.api.chooseVaultFolder()
    if (result) vaultStatus.value = result
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to choose vault folder:', error)
  }
}
</script>

<template>
  <div class="settings-screen">
    <button class="back-arrow" aria-label="Back to board" @click="$emit('back')">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 5 L7 12 L15 19" />
      </svg>
    </button>

    <div class="note">
      <h1 class="note-title">settings</h1>

      <p v-if="loadError" class="warning-banner">
        Something went wrong: {{ loadError }}
      </p>
      <template v-else-if="vaultStatus">
        <p v-if="!vaultStatus.path" class="warning-banner">
          Choose your Obsidian vault in Settings so your tasks get logged
        </p>
        <p v-else-if="!vaultStatus.exists" class="warning-banner">
          Your vault folder can't be found, choose it again
        </p>
      </template>

      <div class="vault-section">
        <p class="vault-label">Obsidian vault folder</p>
        <p class="vault-path">{{ vaultStatus?.path ?? 'not chosen yet' }}</p>
        <button class="choose-button" @click="chooseFolder">Choose vault folder</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-screen {
  height: 100%;
  width: 100%;
  position: relative;
  background: var(--color-board);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
}

.back-arrow {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px;
}

.back-arrow svg {
  width: 100%;
  height: 100%;
}

.back-arrow path {
  fill: none;
  stroke: var(--color-cream);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.note {
  position: relative;
  width: 100%;
  max-width: 340px;
  min-height: 420px;
  background: var(--color-note);
  border: var(--outline-width-thick) solid var(--color-note-border);
  border-radius: var(--radius-note);
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.note-title {
  text-align: center;
  font-size: 1.5rem;
}

.warning-banner {
  background: #fff3d6;
  border: var(--outline-width) solid var(--color-honey);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.85rem;
  color: var(--color-text);
  text-align: center;
}

.vault-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vault-label {
  font-family: var(--font-heading);
  font-size: 1rem;
  color: var(--color-text);
}

.vault-path {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  word-break: break-word;
  background: #fff8ea;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 8px;
  padding: 8px 10px;
}

.choose-button {
  align-self: flex-start;
  padding: 8px 18px;
  border-radius: 8px;
  border: var(--outline-width) solid var(--color-ink);
  background: #fff8ea;
  color: var(--color-text);
  font-family: var(--font-heading);
  cursor: pointer;
}
</style>
