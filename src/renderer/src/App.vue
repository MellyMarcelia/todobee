<script setup lang="ts">
// TL;DR: the top of the app. It just decides which screen is showing right
// now - the board, one open post-it, or settings - and flips between them.
import { ref, onMounted, onUnmounted } from 'vue'
import BoardScreen from './screens/BoardScreen.vue'
import TodayScreen from './screens/TodayScreen.vue'
import SettingsScreen from './screens/SettingsScreen.vue'

// Static screen switch only, no routing library needed yet for three screens.
// A `Screen` type keeps the valid values explicit (basic TS union type).
type Screen = 'board' | 'today' | 'settings'
const currentScreen = ref<Screen>('board')

// Milestone 8b: which post-it to open on the "today" screen - every post-it
// (today's or a past one) is opened by its own note id now that a day can
// have several of them, rather than by date.
const openedNoteId = ref<number | undefined>(undefined)

// Clicked a post-it on the board? Remember which one, and show it.
function openNote(noteId: number): void {
  openedNoteId.value = noteId
  currentScreen.value = 'today'
}

// Cmd/Ctrl+, opens Settings from the app menu (see main/index.ts), same as
// clicking the board's gear icon - the main process just tells us to switch
// screens, it doesn't know or care which screen we were on before.
function openSettingsFromMenu(): void {
  currentScreen.value = 'settings'
}

onMounted(() => {
  window.electron.ipcRenderer.on('open-settings', openSettingsFromMenu)
})

onUnmounted(() => {
  window.electron.ipcRenderer.removeListener('open-settings', openSettingsFromMenu)
})
</script>

<template>
  <BoardScreen
    v-if="currentScreen === 'board'"
    @open="openNote"
    @open-settings="currentScreen = 'settings'"
  />
  <SettingsScreen v-else-if="currentScreen === 'settings'" @back="currentScreen = 'board'" />
  <TodayScreen
    v-else-if="openedNoteId !== undefined"
    :note-id="openedNoteId"
    @back="currentScreen = 'board'"
  />
</template>
