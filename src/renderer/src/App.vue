<script setup lang="ts">
import { ref } from 'vue'
import BoardScreen from './screens/BoardScreen.vue'
import TodayScreen from './screens/TodayScreen.vue'

// Static screen switch only, no routing library needed yet for two screens.
// A `Screen` type keeps the two valid values explicit (basic TS union type).
type Screen = 'board' | 'today'
const currentScreen = ref<Screen>('board')
</script>

<template>
  <BoardScreen v-if="currentScreen === 'board'" @open="currentScreen = 'today'" />
  <TodayScreen v-else @back="currentScreen = 'board'" />
</template>
