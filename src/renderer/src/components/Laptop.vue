<script setup lang="ts">
// Laptop, seen from a 3/4 back angle (screen tilted away, base peeking out
// at an angle beneath it) — redrawn as a flat SVG matching the pose/
// proportions of a reference photo, in our thin-outline flat style
// (2px ink outline, soft grey body, no gradients).
withDefaults(defineProps<{ size?: number }>(), { size: 120 })
</script>

<template>
  <svg viewBox="0 0 100 130" class="laptop" xmlns="http://www.w3.org/2000/svg">
    <!-- base / keyboard deck, seen from behind at the same angle as the lid -->
    <path d="M6 100 L92 88 L96 108 L14 124 Z" class="base" />

    <!-- lid, seen from the back, tilted to the right -->
    <path d="M22 8 L82 20 L74 104 L14 94 Z" class="lid" />

    <!-- highlight rim along the top-left edge of the lid -->
    <path d="M22 8 L28 9 L20 96 L14 94 Z" class="rim" />
  </svg>
</template>

<style scoped>
.laptop {
  width: v-bind('`${size}px`');
  height: auto;
}

.base {
  fill: #8a9098;
  stroke: var(--color-ink);
  stroke-width: 2;
  stroke-linejoin: round;
}

.lid {
  fill: #a7adb3;
  stroke: var(--color-ink);
  stroke-width: 2;
  stroke-linejoin: round;
}

.rim {
  fill: #c7ccd1;
}
</style>
