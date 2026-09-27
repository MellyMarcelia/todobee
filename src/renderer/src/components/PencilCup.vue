<script setup lang="ts">
// Pencil cup with a pencil + pink highlighter — redrawn in the cleaner
// thin-outline flat style to match the reference desk-scene layout.
withDefaults(defineProps<{ size?: number }>(), { size: 48 })
</script>

<template>
  <svg viewBox="0 0 50 60" class="pencil-cup" xmlns="http://www.w3.org/2000/svg">
    <!-- pencil + highlighter (behind the cup rim) -->
    <line x1="18" y1="28" x2="15" y2="8" class="pencil" />
    <line x1="30" y1="28" x2="34" y2="9" class="highlighter" />

    <!-- cup -->
    <rect x="8" y="24" width="34" height="30" rx="5" class="cup" />
  </svg>
</template>

<style scoped>
.pencil-cup {
  width: v-bind('`${size}px`');
  height: auto;
}

.cup {
  fill: #6b7178;
  stroke: var(--color-ink);
  stroke-width: 2;
}

.pencil {
  stroke: var(--color-honey);
  stroke-width: 4;
  stroke-linecap: round;
}

.highlighter {
  stroke: #e0568c;
  stroke-width: 4;
  stroke-linecap: round;
}
</style>
