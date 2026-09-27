<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CheckIcon from '../components/icons/CheckIcon.vue'
import type { Note, Task } from '../../../shared/types'

defineEmits<{ back: [] }>()

// Real data from SQLite via the main process (Milestone 2). `note` is null
// until it loads; the template guards on that so nothing renders too early.
const note = ref<Note | null>(null)
const tasks = ref<Task[]>([])

const newTaskTitle = ref('')
const isAddingTask = ref(false)

// Which task is currently being edited inline, if any. Holding just the id
// (not a boolean per task) keeps only one row editable at a time.
const editingTaskId = ref<number | null>(null)
const editingTitle = ref('')

async function loadTodayNote(): Promise<void> {
  const todayNote = await window.api.getTodayNote()
  note.value = todayNote
  tasks.value = await window.api.listTasks(todayNote.id)
}

onMounted(loadTodayNote)

// Dev-only "simulate next day" (Milestone 4). window.api.simulateNextDay is
// only defined when running `npm run dev` (see preload/index.ts), so this
// button and its handler simply don't exist in a packaged build.
const isDev = import.meta.env.DEV

async function simulateNextDay(): Promise<void> {
  if (!window.api.simulateNextDay) return
  const newToday = await window.api.simulateNextDay()
  note.value = newToday
  tasks.value = await window.api.listTasks(newToday.id)
}

function startAddingTask(): void {
  isAddingTask.value = true
  newTaskTitle.value = ''
}

async function confirmAddTask(): Promise<void> {
  if (!isAddingTask.value) return // already confirmed (e.g. by the Enter keyup); ignore the blur that follows
  isAddingTask.value = false

  const title = newTaskTitle.value.trim()
  newTaskTitle.value = ''
  if (!title || !note.value) return

  const created = await window.api.createTask(note.value.id, { title })
  tasks.value.push(created)
}

async function toggleTaskStatus(task: Task): Promise<void> {
  const nextStatus = task.status === 'open' ? 'done' : 'open'
  const updated = await window.api.setTaskStatus(task.id, nextStatus)
  const index = tasks.value.findIndex((t) => t.id === task.id)
  if (index !== -1) tasks.value[index] = updated
}

function startEditingTask(task: Task): void {
  editingTaskId.value = task.id
  editingTitle.value = task.title
}

async function confirmEditTask(task: Task): Promise<void> {
  if (editingTaskId.value !== task.id) return // already confirmed; ignore the blur that follows
  editingTaskId.value = null

  const title = editingTitle.value.trim()
  if (!title || title === task.title) return

  const updated = await window.api.updateTaskTitle(task.id, title)
  const index = tasks.value.findIndex((t) => t.id === task.id)
  if (index !== -1) tasks.value[index] = updated
}

async function removeTask(task: Task): Promise<void> {
  await window.api.deleteTask(task.id)
  tasks.value = tasks.value.filter((t) => t.id !== task.id)
}
</script>

<template>
  <div class="today-screen">
    <button class="back-arrow" aria-label="Back to board" @click="$emit('back')">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 5 L7 12 L15 19" />
      </svg>
    </button>

    <div v-if="note" class="note">
      <h1 class="note-title">today's buzz</h1>

      <ul class="task-list">
        <li v-for="task in tasks" :key="task.id" class="task-row">
          <button
            class="checkbox"
            :class="{ done: task.status === 'done' }"
            :aria-label="task.status === 'done' ? 'Mark as open' : 'Mark as done'"
            @click="toggleTaskStatus(task)"
          >
            <CheckIcon v-if="task.status === 'done'" />
          </button>

          <input
            v-if="editingTaskId === task.id"
            v-model="editingTitle"
            class="task-text-input"
            type="text"
            autofocus
            @keyup.enter="confirmEditTask(task)"
            @blur="confirmEditTask(task)"
          />
          <span
            v-else
            class="task-text"
            :class="{ done: task.status === 'done' }"
            @click="startEditingTask(task)"
          >
            {{ task.title }}
          </span>

          <button class="delete-button" aria-label="Delete task" @click="removeTask(task)">
            ✕
          </button>
        </li>

        <li class="task-row add-row">
          <span class="checkbox placeholder-checkbox" />
          <input
            v-if="isAddingTask"
            v-model="newTaskTitle"
            class="task-text-input"
            type="text"
            autofocus
            placeholder="type a task…"
            @keyup.enter="confirmAddTask"
            @blur="confirmAddTask"
          />
          <span v-else class="task-text muted" @click="startAddingTask">tap to add…</span>
        </li>
      </ul>

      <!-- help button, bottom-left -->
      <button class="help-button" aria-label="Help">?</button>

      <!-- dev-only: simulate next day, to test rollover without waiting -->
      <button
        v-if="isDev"
        class="dev-next-day-button"
        title="Dev only: simulate next day"
        @click="simulateNextDay"
      >
        ⏭ next day
      </button>
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
  position: relative;
}

.task-row:hover .delete-button {
  opacity: 1;
  pointer-events: auto;
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
  cursor: pointer;
}

.checkbox.done {
  background: var(--color-check-green);
  color: var(--color-check-tick);
}

.checkbox.placeholder-checkbox {
  border-style: dashed;
  opacity: 0.5;
  cursor: default;
}

.task-text {
  font-size: 1.05rem;
  color: var(--color-text);
  flex: 1;
  cursor: text;
}

.task-text.done {
  color: var(--color-text-muted);
  text-decoration: line-through;
}

.task-text.muted {
  color: var(--color-text-muted);
  font-weight: 400;
}

.task-text-input {
  flex: 1;
  font: inherit;
  font-size: 1.05rem;
  color: var(--color-text);
  background: #fff8ea;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 6px;
  padding: 2px 6px;
}

.delete-button {
  position: absolute;
  right: 0;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  font-size: 0.9rem;
  line-height: 1;
}

.add-row {
  opacity: 0.7;
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

.dev-next-day-button {
  position: absolute;
  top: -14px;
  right: 8px;
  font-size: 0.7rem;
  padding: 4px 8px;
  border-radius: 10px;
  border: 1px dashed var(--color-ink);
  background: #fff8ea;
  color: var(--color-text-muted);
  cursor: pointer;
}
</style>
