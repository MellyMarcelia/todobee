<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import CheckIcon from '../components/icons/CheckIcon.vue'
import type { Note, Task } from '../../../shared/types'

// When noteDate is omitted, this screen shows/edits *today's* note (runs
// rollover on load, same as Milestone 2/4). When noteDate is given, it shows
// a specific past note by date — used by the history board (Milestone 7).
// Read-only-ness is decided from the loaded note's own `sealed` flag rather
// than just "was a date passed in", since that's the actual source of truth
// (today's note is always unsealed, every past note is always sealed).
const props = defineProps<{ noteDate?: string }>()
const emit = defineEmits<{ back: [] }>()

const note = ref<Note | null>(null)
const tasks = ref<Task[]>([])
const loadError = ref<string | null>(null)

const isReadOnly = computed(() => note.value?.sealed ?? false)

const newTaskTitle = ref('')
const isAddingTask = ref(false)

// Which task is currently being edited inline, if any. Holding just the id
// (not a boolean per task) keeps only one row editable at a time.
const editingTaskId = ref<number | null>(null)
const editingTitle = ref('')

// Focuses an input as soon as it's inserted. The plain `autofocus` attribute
// isn't enough: Chromium only honors it once per page load, so the second
// "tap to add…" or click-to-edit would show an unfocused input (and its
// blur-to-save would never fire).
const vFocus = { mounted: (el: HTMLElement) => el.focus() }

async function loadNote(): Promise<void> {
  loadError.value = null
  try {
    const loaded = props.noteDate
      ? await window.api.getNoteByDate(props.noteDate)
      : await window.api.getTodayNote()
    if (!loaded) {
      loadError.value = `No note found for ${props.noteDate}.`
      return
    }
    note.value = loaded
    tasks.value = await window.api.listTasks(loaded.id)
  } catch (error) {
    // Without this, a failed IPC call left `note` as null forever and the
    // whole post-it silently vanished with no visible error at all.
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to load note:', error)
  }
}

onMounted(loadNote)

// Dev-only "simulate next day" (Milestone 4). window.api.simulateNextDay is
// only defined when running `npm run dev` (see preload/index.ts), so this
// button and its handler simply don't exist in a packaged build. Only shown
// on today's own (editable) note — simulating from a past note's screen
// would be confusing since it changes the whole app's notion of "today".
const isDev = import.meta.env.DEV
const isSimulatingNextDay = ref(false)

async function simulateNextDay(): Promise<void> {
  if (!window.api.simulateNextDay || isSimulatingNextDay.value) return
  isSimulatingNextDay.value = true
  loadError.value = null
  try {
    const newToday = await window.api.simulateNextDay()
    note.value = newToday
    tasks.value = await window.api.listTasks(newToday.id)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to simulate next day:', error)
  } finally {
    isSimulatingNextDay.value = false
  }
}

function startAddingTask(): void {
  if (isReadOnly.value) return
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

// A read-only past note only allows one interaction: reopening a *done*
// task, which asks for confirmation before moving it to today's note.
// Everything else on a read-only note (adding, editing text, deleting,
// re-completing an already-open task) is disabled.
const taskPendingMove = ref<Task | null>(null)

function onCheckboxClick(task: Task): void {
  if (isReadOnly.value) {
    if (task.status === 'done') taskPendingMove.value = task
    return
  }
  toggleTaskStatus(task)
}

async function confirmMoveToToday(): Promise<void> {
  const task = taskPendingMove.value
  if (!task) return
  const moved = await window.api.moveTaskToToday(task.id)
  tasks.value = tasks.value.filter((t) => t.id !== moved.id)
  taskPendingMove.value = null
}

function cancelMoveToToday(): void {
  taskPendingMove.value = null
}

function startEditingTask(task: Task): void {
  if (isReadOnly.value) return
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
  if (isReadOnly.value) return
  await window.api.deleteTask(task.id)
  tasks.value = tasks.value.filter((t) => t.id !== task.id)
}

// "Done for now" (the folded-corner ✓) doesn't finish or delete anything —
// it just sends the note back to pin itself on the board. A quick fly-back
// animation plays before the screen actually switches, so the note visibly
// flies off rather than just vanishing.
const isFlyingBack = ref(false)

function doneForNow(): void {
  if (isFlyingBack.value) return
  isFlyingBack.value = true
  setTimeout(() => emit('back'), 320)
}

const noteTitle = computed(() => {
  if (!isReadOnly.value) return "today's buzz"
  if (!note.value) return ''
  const [, month, day] = note.value.noteDate.split('-').map(Number)
  const monthName = new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'short' })
  return `${monthName} ${day}`
})
</script>

<template>
  <div class="today-screen">
    <button class="back-arrow" aria-label="Back to board" @click="$emit('back')">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 5 L7 12 L15 19" />
      </svg>
    </button>

    <div v-if="loadError" class="load-error">
      <p>Couldn't load this note.</p>
      <p class="load-error-detail">{{ loadError }}</p>
      <button class="load-error-retry" @click="loadNote">Retry</button>
    </div>

    <div v-else-if="note" class="note" :class="{ 'note-flying-back': isFlyingBack }">
      <h1 class="note-title">{{ noteTitle }}</h1>
      <p v-if="isReadOnly" class="note-readonly-badge">read-only history</p>
      <p v-if="isDev" class="note-date-debug">{{ note.noteDate }}</p>

      <ul class="task-list">
        <li v-for="task in tasks" :key="task.id" class="task-row">
          <button
            class="checkbox"
            :class="{ done: task.status === 'done', 'checkbox-disabled': isReadOnly && task.status === 'open' }"
            :aria-label="task.status === 'done' ? 'Mark as open' : 'Mark as done'"
            @click="onCheckboxClick(task)"
          >
            <CheckIcon v-if="task.status === 'done'" />
          </button>

          <input
            v-if="editingTaskId === task.id"
            v-model="editingTitle"
            v-focus
            class="task-text-input"
            type="text"
            @keyup.enter="confirmEditTask(task)"
            @blur="confirmEditTask(task)"
          />
          <span
            v-else
            class="task-text"
            :class="{ done: task.status === 'done', readonly: isReadOnly }"
            @click="startEditingTask(task)"
          >
            {{ task.title }}
          </span>

          <button
            v-if="!isReadOnly"
            class="delete-button"
            aria-label="Delete task"
            @click="removeTask(task)"
          >
            ✕
          </button>
        </li>

        <li v-if="!isReadOnly" class="task-row add-row">
          <span class="checkbox placeholder-checkbox" />
          <input
            v-if="isAddingTask"
            v-model="newTaskTitle"
            v-focus
            class="task-text-input"
            type="text"
            placeholder="type a task…"
            @keyup.enter="confirmAddTask"
            @blur="confirmAddTask"
          />
          <span v-else class="task-text muted" @click="startAddingTask">tap to add…</span>
        </li>
      </ul>

      <!-- help button, bottom-left -->
      <button class="help-button" aria-label="Help">?</button>

      <!-- folded-corner "done for now": pins the note back to the board
           without finishing or deleting anything. Only on today's own note. -->
      <button
        v-if="!isReadOnly"
        class="fold-corner"
        aria-label="Done for now"
        title="Done for now — pin back to the board"
        @click="doneForNow"
      >
        <CheckIcon />
      </button>

      <!-- dev-only: simulate next day, to test rollover without waiting -->
      <button
        v-if="isDev && !isReadOnly"
        class="dev-next-day-button"
        :disabled="isSimulatingNextDay"
        title="Dev only: simulate next day"
        @click="simulateNextDay"
      >
        {{ isSimulatingNextDay ? '…' : '⏭ next day' }}
      </button>
    </div>

    <div v-if="taskPendingMove" class="move-confirm-overlay">
      <div class="move-confirm-card">
        <p>Move this task to today?</p>
        <p class="move-confirm-title">"{{ taskPendingMove.title }}"</p>
        <div class="move-confirm-buttons">
          <button class="move-confirm-yes" @click="confirmMoveToToday">Move to today</button>
          <button class="move-confirm-no" @click="cancelMoveToToday">Cancel</button>
        </div>
      </div>
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

.load-error {
  width: 100%;
  max-width: 340px;
  min-height: 420px;
  background: var(--color-note);
  border: var(--outline-width-thick) solid var(--color-note-border);
  border-radius: var(--radius-note);
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  color: var(--color-text);
}

.load-error-detail {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  word-break: break-word;
}

.load-error-retry {
  padding: 8px 18px;
  border-radius: 8px;
  border: var(--outline-width) solid var(--color-ink);
  background: #fff8ea;
  color: var(--color-text);
  cursor: pointer;
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
  transition: transform 0.32s ease-in, opacity 0.32s ease-in;
}

.note-flying-back {
  transform: scale(0.15) translateY(-260px);
  opacity: 0;
}

.note-title {
  text-align: center;
  font-size: 1.5rem;
}

.note-readonly-badge {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: -14px;
}

.note-date-debug {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: -12px;
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

.checkbox.checkbox-disabled {
  cursor: default;
  opacity: 0.6;
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

.task-text.readonly {
  cursor: default;
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

.fold-corner {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40px;
  height: 40px;
  border: none;
  border-top: var(--outline-width) solid var(--color-ink);
  border-left: var(--outline-width) solid var(--color-ink);
  border-radius: 20px 0 20px 0;
  background: #fff8ea;
  color: var(--color-check-green);
  padding: 6px 6px 6px 10px;
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

.move-confirm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(43, 38, 34, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.move-confirm-card {
  background: #fff8ea;
  border: var(--outline-width-thick) solid var(--color-ink);
  border-radius: 16px;
  padding: 20px;
  max-width: 280px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.move-confirm-title {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.move-confirm-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 6px;
}

.move-confirm-yes,
.move-confirm-no {
  padding: 8px 14px;
  border-radius: 8px;
  border: var(--outline-width) solid var(--color-ink);
  cursor: pointer;
  font-family: var(--font-heading);
}

.move-confirm-yes {
  background: var(--color-check-green);
  color: #fff8ea;
}

.move-confirm-no {
  background: transparent;
  color: var(--color-text);
}
</style>
