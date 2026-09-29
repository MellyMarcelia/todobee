<script setup lang="ts">
// The top of the app. It decides which screen is showing - the board, one
// opened post-it, or settings - and switches between them.
import { ref, onMounted, onUnmounted } from 'vue'
import BoardScreen from './screens/BoardScreen.vue'
import TodayScreen from './screens/TodayScreen.vue'
import SettingsScreen from './screens/SettingsScreen.vue'

// The three screens, and which one is showing right now.
type Screen = 'board' | 'today' | 'settings'
const currentScreen = ref<Screen>('board')

// Which post-it is opened (by its id number).
const openedNoteId = ref<number | undefined>(undefined)

// Clicked a post-it on the board? Remember which one, and show it.
function openNote(noteId: number): void {
  openedNoteId.value = noteId
  currentScreen.value = 'today'
}

// The Cmd/Ctrl+, shortcut opens Settings, same as clicking the gear icon.
function openSettingsFromMenu(): void {
  currentScreen.value = 'settings'
}

// Start listening for that shortcut when the app opens, and stop when it closes.
onMounted(() => {
  window.electron.ipcRenderer.on('open-settings', openSettingsFromMenu)
})

onUnmounted(() => {
  window.electron.ipcRenderer.removeListener('open-settings', openSettingsFromMenu)
})
</script>

<template>
  <!-- Only one of these three screens shows at a time. -->

  <!-- The board. Clicking a post-it opens it; the gear opens Settings. -->
  <BoardScreen
    v-if="currentScreen === 'board'"
    @open="openNote"
    @open-settings="currentScreen = 'settings'"
  />
  <!-- Settings. The back arrow goes back to the board. -->
  <SettingsScreen v-else-if="currentScreen === 'settings'" @back="currentScreen = 'board'" />
  <!-- One opened post-it. The back arrow (or ✓) goes back to the board. -->
  <TodayScreen
    v-else-if="openedNoteId !== undefined"
    :note-id="openedNoteId"
    @back="currentScreen = 'board'"
  />
</template>
