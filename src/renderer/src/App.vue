<script setup lang="ts">
import { ref } from 'vue'
import BoardScreen from './screens/BoardScreen.vue'
import TodayScreen from './screens/TodayScreen.vue'
import SettingsScreen from './screens/SettingsScreen.vue'

// Static screen switch only, no routing library needed yet for three screens.
// A `Screen` type keeps the valid values explicit (basic TS union type).
type Screen = 'board' | 'today' | 'settings'
const currentScreen = ref<Screen>('board')

// Milestone 7: which note to open on the "today" screen. undefined means
// "today's own note" (the default, editable note); a date string means a
// specific past note, opened read-only from the history board.
const openedNoteDate = ref<string | undefined>(undefined)

function openNote(noteDate: string): void {
  // Board always passes today's real date for the big "today" note, so we
  // still want editable mode there, not read-only — only treat it as a
  // specific past note if it isn't today's date.
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  openedNoteDate.value = noteDate === todayStr ? undefined : noteDate
  currentScreen.value = 'today'
}
</script>

<template>
  <BoardScreen
    v-if="currentScreen === 'board'"
    @open="openNote"
    @open-settings="currentScreen = 'settings'"
  />
  <SettingsScreen v-else-if="currentScreen === 'settings'" @back="currentScreen = 'board'" />
  <TodayScreen v-else :note-date="openedNoteDate" @back="currentScreen = 'board'" />
</template>
