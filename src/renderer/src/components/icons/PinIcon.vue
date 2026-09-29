<script setup lang="ts">
// The six-sided magnet that "pins" each post-it to the board.
// You can pick its colour. It's red unless told otherwise.
withDefaults(defineProps<{ color?: string }>(), { color: '#E76F51' })
</script>

<template>
  <svg viewBox="0 0 24 24" class="pin-icon" xmlns="http://www.w3.org/2000/svg">
    <!-- The six corners of the magnet shape, filled with the chosen colour. -->
    <polygon points="12,1 21,6.5 21,17.5 12,23 3,17.5 3,6.5" :fill="color" />
  </svg>
</template>

<style scoped>
/* The magnet fills whatever box it's put in. */
.pin-icon {
  width: 100%;
  height: 100%;
}

/* A dark outline around the magnet. */
.pin-icon polygon {
  stroke: var(--color-ink);
  stroke-width: 2;
}
</style>
