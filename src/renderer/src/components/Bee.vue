<script setup lang="ts">
// Bee mascot. Wraps a hand-made GIF asset (not drawn by us) so mood/size can
// be swapped from one place. Only "idle" exists for now — Milestone 8 adds
// "happy" (celebration), and Beemodoro reuses this component for its own
// bee states later.
import { computed } from 'vue'
import beeIdle from '../assets/bee/bee-idle.gif'

type Mood = 'idle'

const props = withDefaults(
  defineProps<{
    /** Rendered box size in pixels (square). The gif's own art keeps its aspect ratio, never stretched. */
    size?: number
    mood?: Mood
    /** Small looping up/down "typing" movement — off by default; skipped entirely under prefers-reduced-motion. */
    bob?: boolean
  }>(),
  {
    size: 100,
    mood: 'idle',
    bob: false
  }
)

const moodAssets: Record<Mood, string> = {
  idle: beeIdle
}

// bee-idle.gif is a 500x500 canvas, but the drawn bee doesn't fill it — there
// is empty (now transparent) margin around it, measured once from the actual
// file's alpha channel (not guessed): the bee's content sits inside
// x:[186,328] y:[174,350], centered at (257, 262), covering roughly 142x176.
// These constants crop + zoom the DISPLAY only (via CSS background
// positioning) so the bee fills most of its box instead of looking small
// with wasted transparent space — the original file is never touched.
const SOURCE_SIZE = 500
const BEE_CENTER_X = 257
const BEE_CENTER_Y = 262
const BEE_CONTENT_HEIGHT = 176
const FILL_FRACTION = 0.92 // how much of the box height the bee's content should occupy

const scale = computed(() => (props.size * FILL_FRACTION) / BEE_CONTENT_HEIGHT)

const backgroundSize = computed(() => {
  const px = SOURCE_SIZE * scale.value
  return `${px}px ${px}px`
})

const backgroundPosition = computed(() => {
  const x = props.size / 2 - BEE_CENTER_X * scale.value
  const y = props.size / 2 - BEE_CENTER_Y * scale.value
  return `${x}px ${y}px`
})
</script>

<template>
  <div
    class="bee-mascot"
    :class="{ 'bee-bob': bob }"
    role="img"
    :aria-label="`Bee mascot (${mood})`"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      backgroundImage: `url(${moodAssets[mood]})`,
      backgroundSize,
      backgroundPosition
    }"
  />
</template>

<style scoped>
.bee-mascot {
  display: block;
  background-repeat: no-repeat;
}

@media (prefers-reduced-motion: no-preference) {
  .bee-bob {
    animation: bee-typing-bob 0.6s ease-in-out infinite;
  }
}

@keyframes bee-typing-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}
</style>
