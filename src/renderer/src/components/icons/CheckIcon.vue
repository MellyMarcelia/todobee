<!-- The tick mark. It takes on the colour of whatever it sits in. -->
<template>
  <svg viewBox="0 0 24 24" class="check-icon" xmlns="http://www.w3.org/2000/svg">
    <!-- One line: down to the bottom of the tick, then up to the right. -->
    <path d="M5 13 L10 18 L19 7" />
  </svg>
</template>

<style scoped>
/* The tick fills whatever box it's put in. */
.check-icon {
  width: 100%;
  height: 100%;
}

/* Drawn as a thick, rounded line in the colour of whatever it sits in. */
.check-icon path {
  fill: none;
  stroke: currentColor;
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
