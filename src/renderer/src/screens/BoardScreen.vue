<script setup lang="ts">
import Bee from '../components/Bee.vue'
import PinIcon from '../components/icons/PinIcon.vue'

defineEmits<{ open: [] }>()

// Placeholder notes for the board — Milestone 7 replaces this with real history data.
const placeholderNotes = [
  { color: '#F6C56A', pin: '#E76F51' },
  { color: '#9FD8A3', pin: '#4A90D9' },
  { color: '#F2A6C4', pin: '#E9A23B' }
]
</script>

<template>
  <div class="board-screen">
    <section class="board">
      <h2 class="board-title">your hive board :)</h2>

      <div class="notes-row">
        <button
          v-for="(note, i) in placeholderNotes"
          :key="i"
          class="pinned-note"
          :style="{ background: note.color }"
          @click="$emit('open')"
        >
          <span class="pin"><PinIcon :color="note.pin" /></span>
          <span class="pinned-note-lines">
            <span class="line" />
            <span class="line short" />
          </span>
        </button>
      </div>
    </section>

    <section class="desk">
      <!-- bee sitting at the desk, bottom-right.
           Laptop/stationery/desk removed for now — to be redesigned later. -->
      <div class="bee-at-desk">
        <Bee :size="150" mood="idle" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.board-screen {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-cream);
}

.board {
  flex: 0 0 55%;
  margin: 20px 20px 0;
  padding: 20px 18px;
  background: var(--color-board);
  border: var(--outline-width-thick) solid var(--color-board-border);
  border-radius: var(--radius-board);
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: hidden;
}

.board-title {
  font-size: 1.1rem;
  text-align: center;
  color: #fff8ea;
}

.notes-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.pinned-note {
  position: relative;
  width: 88px;
  height: 88px;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 8px;
  cursor: pointer;
  padding: 18px 10px 10px;
  transform: rotate(-3deg);
  font: inherit;
}

.pinned-note:nth-child(2) {
  transform: rotate(2deg);
}

.pinned-note:nth-child(3) {
  transform: rotate(-1deg);
}

.pin {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
}

.pinned-note-lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  justify-content: center;
}

.line {
  height: 4px;
  border-radius: 2px;
  background: rgba(43, 38, 34, 0.35);
}

.line.short {
  width: 60%;
}

.desk {
  position: relative;
  flex: 0 0 45%;
  overflow: hidden;
}

.bee-at-desk {
  position: absolute;
  right: 24px;
  bottom: 60px;
}
</style>
