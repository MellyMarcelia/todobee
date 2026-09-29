<script setup lang="ts">
// A little laptop drawing, seen from behind. Not used anywhere right now -
// it was taken off the desk until the desk gets redesigned.
// "size" is how wide it is, in pixels (120 unless told otherwise).
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
/* The drawing's width comes from the "size" setting; the height follows along. */
.laptop {
  width: v-bind('`${size}px`');
  height: auto;
}

/* The keyboard part: dark grey with a dark outline. */
.base {
  fill: #8a9098;
  stroke: var(--color-ink);
  stroke-width: 2;
  stroke-linejoin: round;
}

/* The lid: a lighter grey with a dark outline. */
.lid {
  fill: #a7adb3;
  stroke: var(--color-ink);
  stroke-width: 2;
  stroke-linejoin: round;
}

/* The shiny edge: the lightest grey. */
.rim {
  fill: #c7ccd1;
}
</style>
