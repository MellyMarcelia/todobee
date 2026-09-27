<script setup lang="ts">
// Small "tap" marks that pop up and fade next to the laptop while the bee
// types. Three flat, outlined tick marks, staggered so they don't blink in
// sync. Purely decorative — safe to remove/replace once real typing state exists.
</script>

<template>
  <div class="typing-marks" aria-hidden="true">
    <svg class="mark mark-1" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 10 L9 14 L16 5" />
    </svg>
    <svg class="mark mark-2" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="10" x2="17" y2="10" />
    </svg>
    <svg class="mark mark-3" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="7" x2="17" y2="7" />
      <line x1="3" y1="13" x2="12" y2="13" />
    </svg>
  </div>
</template>

<style scoped>
.typing-marks {
  position: relative;
  width: 60px;
  height: 40px;
  pointer-events: none;
}

.mark {
  position: absolute;
  width: 18px;
  height: 18px;
  opacity: 0;
}

.mark path,
.mark line {
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mark-1 {
  top: 4px;
  left: 4px;
}

.mark-2 {
  top: 0;
  left: 26px;
}

.mark-3 {
  top: 10px;
  left: 44px;
}

@media (prefers-reduced-motion: no-preference) {
  .mark-1 {
    animation: pop-fade 1.8s ease-in-out infinite;
    animation-delay: 0s;
  }
  .mark-2 {
    animation: pop-fade 1.8s ease-in-out infinite;
    animation-delay: 0.5s;
  }
  .mark-3 {
    animation: pop-fade 1.8s ease-in-out infinite;
    animation-delay: 1s;
  }
}

@keyframes pop-fade {
  0% {
    opacity: 0;
    transform: translateY(4px) scale(0.8);
  }
  30% {
    opacity: 1;
    transform: translateY(-2px) scale(1);
  }
  70% {
    opacity: 1;
    transform: translateY(-6px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-10px) scale(0.9);
  }
}
</style>
