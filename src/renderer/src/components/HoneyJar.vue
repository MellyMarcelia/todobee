<script setup lang="ts">
// Small honey jar — balances the stationery on the desk's other side.
withDefaults(defineProps<{ size?: number }>(), { size: 40 })
</script>

<template>
  <svg viewBox="0 0 44 50" class="honey-jar" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="4" width="24" height="9" rx="3" class="lid" />
    <path d="M8 13 h28 v24 a14 14 0 0 1 -14 14 a14 14 0 0 1 -14 -14 z" class="jar-body" />
  </svg>
</template>

<style scoped>
.honey-jar {
  width: v-bind('`${size}px`');
  height: auto;
}

.jar-body {
  fill: var(--color-honey);
  stroke: var(--color-ink);
  stroke-width: 3;
}

.lid {
  fill: var(--color-note-border);
  stroke: var(--color-ink);
  stroke-width: 3;
}
</style>
