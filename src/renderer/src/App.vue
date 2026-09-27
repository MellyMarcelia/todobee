<script setup lang="ts">
import { ref } from 'vue'
import BoardScreen from './screens/BoardScreen.vue'
import TodayScreen from './screens/TodayScreen.vue'
import SettingsScreen from './screens/SettingsScreen.vue'

// Static screen switch only, no routing library needed yet for three screens.
// A `Screen` type keeps the valid values explicit (basic TS union type).
type Screen = 'board' | 'today' | 'settings'
const currentScreen = ref<Screen>('board')
</script>

<template>
  <BoardScreen
    v-if="currentScreen === 'board'"
    @open="currentScreen = 'today'"
    @open-settings="currentScreen = 'settings'"
  />
  <SettingsScreen v-else-if="currentScreen === 'settings'" @back="currentScreen = 'board'" />
  <TodayScreen v-else @back="currentScreen = 'board'" />
</template>
