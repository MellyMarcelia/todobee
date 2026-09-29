<script setup lang="ts">
// The settings page. For now it does one thing: lets you pick which
// Obsidian vault folder your task log is written into.
import { ref, onMounted } from 'vue'
import type { VaultStatus } from '../../../shared/types'

// The one message this screen sends up to App.vue: "go back to the board".
defineEmits<{ back: [] }>()

// Empty (null) while still loading, so we don't flash a "no folder chosen"
// warning for a split second before the real answer arrives.
const vaultStatus = ref<VaultStatus | null>(null)
// If something goes wrong, the problem is kept here and shown on screen.
const loadError = ref<string | null>(null)

// Ask which folder is saved, and whether it can still be found.
async function loadVaultStatus(): Promise<void> {
  loadError.value = null
  try {
    vaultStatus.value = await window.api.getVaultStatus()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to load vault status:', error)
  }
}

// Check as soon as the settings page opens.
onMounted(loadVaultStatus)

// Pops open the normal "pick a folder" window and saves whatever you choose.
async function chooseFolder(): Promise<void> {
  loadError.value = null
  try {
    // If you press Cancel we get nothing back, and nothing changes.
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
    <!-- The ‹ arrow in the top-left corner: back to the board. -->
    <button class="back-arrow" aria-label="Back to board" @click="$emit('back')">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 5 L7 12 L15 19" />
      </svg>
    </button>

    <!-- The settings card, styled like a big post-it. -->
    <div class="note">
      <h1 class="note-title">settings</h1>

      <!-- Yellow warning box: something went wrong, no folder picked yet,
           or the folder can't be found. Nothing shows while still loading. -->
      <p v-if="loadError" class="warning-banner">Something went wrong: {{ loadError }}</p>
      <template v-else-if="vaultStatus">
        <p v-if="!vaultStatus.path" class="warning-banner">
          Choose your Obsidian vault in Settings so your tasks get logged
        </p>
        <p v-else-if="!vaultStatus.exists" class="warning-banner">
          Your vault folder can't be found, choose it again
        </p>
      </template>

      <!-- The folder part: a label, the saved folder (or "not chosen yet"),
           and the button that opens the folder picker. -->
      <div class="vault-section">
        <p class="vault-label">Obsidian vault folder</p>
        <p class="vault-path">{{ vaultStatus?.path ?? 'not chosen yet' }}</p>
        <button class="choose-button" @click="chooseFolder">Choose vault folder</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The whole screen: brown background, with the settings card in the middle. */
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

/* The ‹ back button in the top-left corner. */
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

/* The arrow drawing fills its button. */
.back-arrow svg {
  width: 100%;
  height: 100%;
}

/* The arrow is drawn as a thick, rounded cream line. */
.back-arrow path {
  fill: none;
  stroke: var(--color-cream);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* The settings card. It looks like a big yellow post-it. */
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

/* The "settings" heading. */
.note-title {
  text-align: center;
  font-size: 1.5rem;
}

/* The pale yellow warning box. */
.warning-banner {
  background: #fff3d6;
  border: var(--outline-width) solid var(--color-honey);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.85rem;
  color: var(--color-text);
  text-align: center;
}

/* The folder part, stacked top to bottom. */
.vault-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* The "Obsidian vault folder" label. */
.vault-label {
  font-family: var(--font-heading);
  font-size: 1rem;
  color: var(--color-text);
}

/* The box showing the saved folder. Long folder paths wrap onto the next line instead of
   spilling out. */
.vault-path {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  word-break: break-word;
  background: #fff8ea;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 8px;
  padding: 8px 10px;
}

/* The "Choose vault folder" button, on the left. */
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
