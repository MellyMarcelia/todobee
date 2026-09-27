<script setup lang="ts">
// Office chair backrest, sits behind the bee — redrawn in the cleaner
// thin-outline flat style (2-2.5px), tall and rounded so its top peeks out
// clearly above the bee's head, matching the reference desk-scene layout.
withDefaults(defineProps<{ width?: number; height?: number }>(), { width: 220, height: 220 })
</script>

<template>
  <svg viewBox="0 0 140 160" class="chair" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="4" width="112" height="132" rx="40" class="backrest" />
    <rect x="40" y="126" width="12" height="26" rx="4" class="leg" />
    <rect x="88" y="126" width="12" height="26" rx="4" class="leg" />
  </svg>
</template>

<style scoped>
.chair {
  width: v-bind('`${width}px`');
  height: v-bind('`${height}px`');
}

.backrest {
  fill: #494e54;
  stroke: var(--color-ink);
  stroke-width: 2.5;
}

.leg {
  fill: #3a3e43;
  stroke: var(--color-ink);
  stroke-width: 2;
}
</style>
