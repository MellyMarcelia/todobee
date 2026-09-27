<script setup lang="ts">
import CheckIcon from '../components/icons/CheckIcon.vue'

defineEmits<{ back: [] }>()

// Static placeholder tasks — Milestone 2 replaces this with real SQLite data.
const placeholderTasks = [
  { title: 'Write PRD acceptance criteria', done: false },
  { title: 'Sketch bee mascot poses', done: true },
  { title: 'Set up electron-vite skeleton', done: true }
]
</script>

<template>
  <div class="today-screen">
    <button class="back-arrow" aria-label="Back to board" @click="$emit('back')">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 5 L7 12 L15 19" />
      </svg>
    </button>

    <div class="note">
      <h1 class="note-title">today's buzz</h1>

      <ul class="task-list">
        <li v-for="(task, i) in placeholderTasks" :key="i" class="task-row">
          <span class="checkbox" :class="{ done: task.done }">
            <CheckIcon v-if="task.done" />
          </span>
          <span class="task-text" :class="{ done: task.done }">{{ task.title }}</span>
        </li>
        <li class="task-row add-row">
          <span class="checkbox placeholder-checkbox" />
          <span class="task-text muted">tap to add…</span>
        </li>
      </ul>

      <!-- folded corner / finish button -->
      <button class="fold-corner" aria-label="Finish note">
        <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 60 L60 60 L60 0 Z" class="fold-shape" />
        </svg>
        <span class="fold-check">
          <CheckIcon />
        </span>
      </button>

      <!-- decorative honey dipper + pencil, bottom-right -->
      <svg viewBox="0 0 80 60" class="decoration" xmlns="http://www.w3.org/2000/svg">
        <line x1="10" y1="50" x2="24" y2="20" class="pencil-deco" />
        <path
          d="M50 14 q10 -6 14 4 q3 8 -6 12 q6 4 2 12 q-4 8 -12 2 q-6 4 -8 -4"
          class="dipper-deco"
        />
      </svg>

      <!-- help button, bottom-left -->
      <button class="help-button" aria-label="Help">?</button>
    </div>
  </div>
</template>

<style scoped>
.today-screen {
  height: 100%;
  width: 100%;
  position: relative;
  background: var(--color-board);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
}

.back-arrow {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px;
}

.back-arrow svg {
  width: 100%;
  height: 100%;
}

.back-arrow path {
  fill: none;
  stroke: var(--color-cream);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.note {
  position: relative;
  width: 100%;
  max-width: 340px;
  min-height: 420px;
  background: var(--color-note);
  border: var(--outline-width-thick) solid var(--color-note-border);
  border-radius: var(--radius-note);
  padding: 28px 24px 60px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.note-title {
  text-align: center;
  font-size: 1.5rem;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.checkbox {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 6px;
  background: #fff8ea;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.checkbox.done {
  background: var(--color-check-green);
  color: var(--color-check-tick);
}

.checkbox.placeholder-checkbox {
  border-style: dashed;
  opacity: 0.5;
}

.task-text {
  font-size: 1.05rem;
  color: var(--color-text);
}

.task-text.done {
  color: var(--color-text-muted);
  text-decoration: line-through;
}

.task-text.muted {
  color: var(--color-text-muted);
  font-weight: 400;
}

.add-row {
  opacity: 0.7;
}

.fold-corner {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 60px;
  height: 60px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  border-bottom-right-radius: var(--radius-note);
  overflow: hidden;
}

.fold-corner svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.fold-shape {
  fill: var(--color-note-border);
  stroke: var(--color-ink);
  stroke-width: 2;
}

.fold-check {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  color: #fff8ea;
}

.decoration {
  position: absolute;
  bottom: 60px;
  right: 8px;
  width: 70px;
  height: 52px;
  pointer-events: none;
}

.pencil-deco {
  stroke: var(--color-honey);
  stroke-width: 5;
  stroke-linecap: round;
}

.dipper-deco {
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 3;
  stroke-linecap: round;
}

.help-button {
  position: absolute;
  bottom: 14px;
  left: 14px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: var(--outline-width) solid var(--color-ink);
  background: #fff8ea;
  color: var(--color-text);
  font-family: var(--font-heading);
  font-weight: 800;
  cursor: pointer;
}
</style>
