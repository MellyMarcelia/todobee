<script setup lang="ts">
// Small stack of papers/sticky notes — redrawn in the cleaner thin-outline
// flat style, as a stepped paper stack (matching the reference), rather
// than overlapping rounded rectangles.
withDefaults(defineProps<{ size?: number }>(), { size: 34 })
</script>

<template>
  <svg viewBox="0 0 44 34" class="note-stack" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="20" width="36" height="6" class="sheet" />
    <rect x="4" y="14" width="32" height="6" class="sheet" />
    <rect x="6" y="8" width="28" height="6" class="sheet" />
    <rect x="8" y="2" width="24" height="6" class="sheet sheet-top" />
  </svg>
</template>

<style scoped>
.note-stack {
  width: v-bind('`${size}px`');
  height: auto;
}

.sheet {
  fill: var(--color-note);
  stroke: var(--color-ink);
  stroke-width: 2;
}

.sheet-top {
  fill: #f9d68b;
}
</style>
