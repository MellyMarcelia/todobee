<script setup lang="ts">
// Small grey badge box with a "?" — a placeholder decorative prop next to
// the stationery, echoing the reference desk-scene's mystery box. Not wired
// to any feature yet (a natural home for a future badge/reward hint).
withDefaults(defineProps<{ size?: number }>(), { size: 36 })
</script>

<template>
  <svg viewBox="0 0 40 40" class="mystery-box" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="6" class="box" />
    <text x="20" y="27" text-anchor="middle" class="mark">?</text>
  </svg>
</template>

<style scoped>
.mystery-box {
  width: v-bind('`${size}px`');
  height: auto;
}

.box {
  fill: #8a9098;
  stroke: var(--color-ink);
  stroke-width: 2;
}

.mark {
  font-family: var(--font-heading);
  font-size: 20px;
  font-weight: 800;
  fill: var(--color-ink);
}
</style>
