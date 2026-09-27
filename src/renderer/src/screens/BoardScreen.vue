<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Bee from '../components/Bee.vue'
import PinIcon from '../components/icons/PinIcon.vue'
import GearIcon from '../components/icons/GearIcon.vue'
import type { VaultStatus } from '../../../shared/types'

defineEmits<{ open: []; 'open-settings': [] }>()

// Placeholder notes for the board — Milestone 7 replaces this with real history data.
const placeholderNotes = [
  { color: '#F6C56A', pin: '#E76F51' },
  { color: '#9FD8A3', pin: '#4A90D9' },
  { color: '#F2A6C4', pin: '#E9A23B' }
]

// Milestone 5: show a warning banner when no vault is chosen yet, or when
// the previously-chosen vault folder can no longer be found. The app still
// works normally either way — this is just a nudge to visit Settings.
const vaultStatus = ref<VaultStatus | null>(null)

async function loadVaultStatus(): Promise<void> {
  try {
    vaultStatus.value = await window.api.getVaultStatus()
  } catch (error) {
    console.error('Failed to load vault status:', error)
  }
}

onMounted(loadVaultStatus)
</script>

<template>
  <div class="board-screen">
    <section class="board">
      <div class="board-header">
        <h2 class="board-title">to-do</h2>
        <button
          class="settings-button"
          aria-label="Settings"
          @click="$emit('open-settings')"
        >
          <GearIcon />
        </button>
      </div>

      <p v-if="vaultStatus && !vaultStatus.path" class="warning-banner">
        Choose your Obsidian vault in Settings so your tasks get logged
      </p>
      <p v-else-if="vaultStatus && !vaultStatus.exists" class="warning-banner">
        Your vault folder can't be found, choose it again
      </p>

      <div class="notes-row">
        <button
          v-for="(note, i) in placeholderNotes"
          :key="i"
          class="pinned-note"
          :style="{ background: note.color }"
          @click="$emit('open')"
        >
          <span class="pin"><PinIcon :color="note.pin" /></span>
          <span class="pinned-note-lines">
            <span class="line" />
            <span class="line short" />
          </span>
        </button>
      </div>
    </section>

    <section class="desk">
      <!-- bee sitting at the desk, bottom-right.
           Laptop/stationery/desk removed for now — to be redesigned later. -->
      <div class="bee-at-desk">
        <Bee :size="150" mood="idle" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.board-screen {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-cream);
}

.board {
  flex: 1 1 55%;
  min-height: 0;
  margin: 20px 20px 0;
  padding: 20px 18px;
  background: var(--color-board);
  border: var(--outline-width-thick) solid var(--color-board-border);
  border-radius: var(--radius-board);
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.board-header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 10px;
}

.settings-button {
  position: absolute;
  right: 0;
  top: -2px;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #fff8ea;
  padding: 0;
  cursor: pointer;
}

.warning-banner {
  background: #fff3d6;
  border: var(--outline-width) solid var(--color-honey);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.75rem;
  color: var(--color-text);
  text-align: center;
}

.board-title {
  font-size: 1.1rem;
  text-align: center;
  color: #fff8ea;
}

.notes-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.pinned-note {
  position: relative;
  width: 88px;
  height: 88px;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 8px;
  cursor: pointer;
  padding: 18px 10px 10px;
  transform: rotate(-3deg);
  font: inherit;
}

.pinned-note:nth-child(2) {
  transform: rotate(2deg);
}

.pinned-note:nth-child(3) {
  transform: rotate(-1deg);
}

.pin {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
}

.pinned-note-lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  justify-content: center;
}

.line {
  height: 4px;
  border-radius: 2px;
  background: rgba(43, 38, 34, 0.35);
}

.line.short {
  width: 60%;
}

.desk {
  position: relative;
  flex: 0 0 220px;
  overflow: hidden;
}

.bee-at-desk {
  position: absolute;
  right: 24px;
  bottom: 12px;
}
</style>
