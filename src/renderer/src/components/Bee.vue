<script setup lang="ts">
// Our bee buddy! Shows the bee animation at any size, and can gently bob
// up and down, or do a happy wiggle when you finish all your tasks.
import { computed } from 'vue'
import beeIdle from '../assets/bee/bee-idle.gif'

// The bee's moods: "idle" (just hanging out) or "happy" (celebrating).
type Mood = 'idle' | 'happy'

// The settings you can give the bee, and what they are if you don't.
const props = withDefaults(
  defineProps<{
    /** How big the bee is, in pixels. The bee is never stretched. */
    size?: number
    /** "idle" or "happy" (does a little wiggle). */
    mood?: Mood
    /** Gentle up-and-down movement. Off unless asked for. */
    bob?: boolean
  }>(),
  {
    size: 100,
    mood: 'idle',
    bob: false
  }
)

// Which picture to use for each mood. There's no separate "happy" picture
// yet, so the happy bee uses the normal one plus a wiggle animation (see
// .bee-happy below). If a happy picture is added later, just change it here.
const moodAssets: Record<Mood, string> = {
  idle: beeIdle,
  happy: beeIdle
}

// The bee picture has a lot of empty space around the bee. These numbers
// (measured from the picture) say where the bee actually is, so we can zoom
// in and centre it - otherwise the bee would look tiny in its box.
// Only what's shown on screen changes; the picture file itself is untouched.
const SOURCE_SIZE = 500 // the picture is 500 x 500 pixels
const BEE_CENTER_X = 257 // where the middle of the bee is
const BEE_CENTER_Y = 262
const BEE_CONTENT_HEIGHT = 176 // how tall the bee itself is
const FILL_FRACTION = 0.92 // the bee should fill 92% of the box's height

// How much to zoom the picture so the bee fills the box nicely.
const scale = computed(() => (props.size * FILL_FRACTION) / BEE_CONTENT_HEIGHT)

// How big the whole zoomed picture ends up.
const backgroundSize = computed(() => {
  const px = SOURCE_SIZE * scale.value
  return `${px}px ${px}px`
})

// Slides the zoomed picture so the middle of the bee lands in the middle
// of the box.
const backgroundPosition = computed(() => {
  const x = props.size / 2 - BEE_CENTER_X * scale.value
  const y = props.size / 2 - BEE_CENTER_Y * scale.value
  return `${x}px ${y}px`
})
</script>

<template>
  <!-- A square box with the bee picture as its background, zoomed and
       centred using the numbers worked out above. -->
  <div
    class="bee-mascot"
    :class="{ 'bee-bob': bob, 'bee-happy': mood === 'happy' }"
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
/* The bee's box. The picture is drawn once (not tiled); its size and position come from the
   script above. */
.bee-mascot {
  display: block;
  background-repeat: no-repeat;
}

/* Animations only play if your computer isn't set to "reduce motion". */
@media (prefers-reduced-motion: no-preference) {
  /* The gentle bob: up and down, forever, 0.6 seconds each time. */
  .bee-bob {
    animation: bee-typing-bob 0.6s ease-in-out infinite;
  }

  /* The happy wiggle. Plays once each time the happy bee appears, and ends
     back in its normal pose. */
  .bee-happy {
    animation: bee-celebrate 0.8s ease-in-out 1;
    animation-fill-mode: forwards;
  }
}

/* The bob movement: start, float up 3 pixels halfway, then back down. */
@keyframes bee-typing-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

/* The happy wiggle: two hops with a tilt and a little grow, each smaller than the last, then
   back to normal. */
@keyframes bee-celebrate {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  20% {
    transform: translateY(-14px) rotate(-8deg) scale(1.08);
  }
  40% {
    transform: translateY(0) rotate(6deg) scale(1);
  }
  60% {
    transform: translateY(-8px) rotate(-4deg) scale(1.04);
  }
  80% {
    transform: translateY(0) rotate(2deg) scale(1);
  }
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
}
</style>
