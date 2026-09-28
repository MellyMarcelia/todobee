<script setup lang="ts">
// One post-it, opened up big. Here you can add, tick, edit and delete
// tasks, rename the post-it, and push unfinished tasks to tomorrow. Finish
// everything and you get the "good job" stamp and a happy bee. Old post-its
// open here too, but they're locked (look, don't touch).
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import CheckIcon from '../components/icons/CheckIcon.vue'
import Bee from '../components/Bee.vue'
import goodJobStamp from '../assets/stamps/good-job-stamp.png'
import type { Note, Task } from '../../../shared/types'

// Which post-it to show (by its id number).
const props = defineProps<{ noteId: number }>()
const emit = defineEmits<{ back: [] }>()

const note = ref<Note | null>(null)
const tasks = ref<Task[]>([])
const loadError = ref<string | null>(null)

// Old post-its are locked, so most buttons are switched off for them.
const isReadOnly = computed(() => note.value?.sealed ?? false)

const newTaskTitle = ref('')
const isAddingTask = ref(false)

// Which task you're currently editing, if any. Only one at a time.
const editingTaskId = ref<number | null>(null)
const editingTitle = ref('')

// Puts the typing cursor straight into a text box as soon as it appears,
// so you can start typing right away.
const vFocus = { mounted: (el: HTMLElement) => el.focus() }

// Loads the post-it and its tasks.
async function loadNote(): Promise<void> {
  loadError.value = null
  hasLoadedOnce = false
  try {
    const loaded = await window.api.getNoteById(props.noteId)
    if (!loaded) {
      loadError.value = `No post-it found (id ${props.noteId}).`
      return
    }
    note.value = loaded
    tasks.value = await window.api.listTasks(loaded.id)
    // Wait a moment before switching on the celebration. Otherwise opening
    // a post-it that's already all done would make the bee celebrate.
    await nextTick()
    hasLoadedOnce = true
  } catch (error) {
    // Show the problem on screen instead of just showing nothing.
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to load note:', error)
  }
}

onMounted(loadNote)

// True only while developing - used to show the post-it's date for testing.
const isDev = import.meta.env.DEV

// The "move this to the next day" button. Sends this post-it's unfinished
// tasks to the same post-it tomorrow. This post-it stays open today with its
// finished tasks. The button only shows when there's something unfinished.
const hasOpenTasks = computed(() => tasks.value.some((t) => t.status === 'open'))
const isMovingToNextDay = ref(false)
const movedMessage = ref<string | null>(null)
let movedMessageTimeout: ReturnType<typeof setTimeout> | undefined
// After moving tasks away, only finished ones are left, which looks like
// "all done". But putting things off isn't finishing them, so no celebration.
let skipNextCelebration = false

async function moveOpenTasksToNextDay(): Promise<void> {
  if (!note.value || isMovingToNextDay.value) return
  isMovingToNextDay.value = true
  try {
    const movedCount = await window.api.moveOpenTasksToNextDay(note.value.id)
    skipNextCelebration = true
    tasks.value = await window.api.listTasks(note.value.id)
    await nextTick()
    skipNextCelebration = false
    movedMessage.value = `${movedCount} task${movedCount === 1 ? '' : 's'} moved to tomorrow`
    clearTimeout(movedMessageTimeout)
    movedMessageTimeout = setTimeout(() => {
      movedMessage.value = null
    }, 2500)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to move tasks to the next day:', error)
  } finally {
    isMovingToNextDay.value = false
  }
}

// You clicked "tap to add…" - show a text box instead.
function startAddingTask(): void {
  if (isReadOnly.value) return
  isAddingTask.value = true
  newTaskTitle.value = ''
}

// You pressed Enter (or clicked away) - save the new task, unless the box is empty.
async function confirmAddTask(): Promise<void> {
  // Pressing Enter and then clicking away both land here - only save once.
  if (!isAddingTask.value) return
  isAddingTask.value = false

  const title = newTaskTitle.value.trim()
  newTaskTitle.value = ''
  if (!title || !note.value) return

  const created = await window.api.createTask(note.value.id, { title })
  tasks.value.push(created)
}

// Ticks or un-ticks a task.
async function toggleTaskStatus(task: Task): Promise<void> {
  const nextStatus = task.status === 'open' ? 'done' : 'open'
  const updated = await window.api.setTaskStatus(task.id, nextStatus)
  const index = tasks.value.findIndex((t) => t.id === task.id)
  if (index !== -1) tasks.value[index] = updated
}

// On a locked old post-it, the only thing you can do is un-tick a finished
// task. That asks "move this task to today?" before doing anything.
// Everything else (adding, editing, deleting) is switched off.
const taskPendingMove = ref<Task | null>(null)

function onCheckboxClick(task: Task): void {
  if (isReadOnly.value) {
    if (task.status === 'done') taskPendingMove.value = task
    return
  }
  toggleTaskStatus(task)
}

// You said yes in the popup: move the task to today and remove it from this old post-it.
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

// You clicked a task's text - turn it into a text box so you can change it.
function startEditingTask(task: Task): void {
  if (isReadOnly.value) return
  editingTaskId.value = task.id
  editingTitle.value = task.title
}

// Done editing - save it, unless it's empty or nothing actually changed.
async function confirmEditTask(task: Task): Promise<void> {
  // Pressing Enter and then clicking away both land here - only save once.
  if (editingTaskId.value !== task.id) return
  editingTaskId.value = null

  const title = editingTitle.value.trim()
  if (!title || title === task.title) return

  const updated = await window.api.updateTaskTitle(task.id, title)
  const index = tasks.value.findIndex((t) => t.id === task.id)
  if (index !== -1) tasks.value[index] = updated
}

// The ✕ next to a task - delete it.
async function removeTask(task: Task): Promise<void> {
  if (isReadOnly.value) return
  await window.api.deleteTask(task.id)
  tasks.value = tasks.value.filter((t) => t.id !== task.id)
}

// The ✓ in the folded corner ("done for now"). It doesn't finish or delete
// anything - it just sends the post-it back to the board, with a short
// fly-away animation first.
const isFlyingBack = ref(false)

function doneForNow(): void {
  if (isFlyingBack.value) return
  isFlyingBack.value = true
  setTimeout(() => emit('back'), 320)
}

// Click the post-it's name to rename it (not on locked old post-its).
const isEditingTitle = ref(false)
const editingNoteTitle = ref('')

function startEditingTitle(): void {
  if (isReadOnly.value || !note.value) return
  isEditingTitle.value = true
  editingNoteTitle.value = note.value.title
}

async function confirmEditTitle(): Promise<void> {
  if (!isEditingTitle.value || !note.value) return
  isEditingTitle.value = false

  const title = editingNoteTitle.value.trim()
  if (!title || title === note.value.title) return

  note.value = await window.api.renameNote(note.value.id, title)
}

// The "good job" stamp shows when there's at least one task and all of them
// are done (the same rule used when saving, in perfectDay.ts).
const isPerfectDay = computed(
  () => tasks.value.length > 0 && tasks.value.every((t) => t.status === 'done')
)

// The happy bee should pop up once, right at the moment you tick the last
// task - not every time you look at an already-finished post-it.
// celebrationKey goes up by one each time, which makes the bee's animation
// start over from the beginning.
const isCelebrating = ref(false)
const celebrationKey = ref(0)
let celebrationTimeout: ReturnType<typeof setTimeout> | undefined
// Stays false until the post-it has finished loading, so opening an
// already-finished post-it doesn't trigger the celebration.
let hasLoadedOnce = false

watch(isPerfectDay, (nowPerfect, wasPerfect) => {
  if (nowPerfect && !wasPerfect && hasLoadedOnce && !skipNextCelebration) {
    isCelebrating.value = true
    celebrationKey.value += 1
    clearTimeout(celebrationTimeout)
    celebrationTimeout = setTimeout(() => {
      isCelebrating.value = false
    }, 900)
  }
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

    <div
      v-else-if="note"
      class="note"
      :class="{ 'note-flying-back': isFlyingBack }"
      :style="{
        background: isReadOnly ? 'var(--color-note-past)' : note.colour,
        borderColor: 'var(--color-note-border)'
      }"
    >
      <input
        v-if="isEditingTitle"
        v-model="editingNoteTitle"
        v-focus
        class="note-title-input"
        type="text"
        @keyup.enter="confirmEditTitle"
        @blur="confirmEditTitle"
      />
      <h1 v-else class="note-title" :class="{ readonly: isReadOnly }" @click="startEditingTitle">
        {{ note.title }}
      </h1>
      <p v-if="isReadOnly" class="note-readonly-badge">read-only history</p>
      <p v-if="isDev" class="note-date-debug">{{ note.noteDate }}</p>

      <!-- The "good job" stamp, shown once every task is done. -->
      <img v-if="isPerfectDay" :src="goodJobStamp" alt="Good job stamp" class="good-job-stamp" />

      <ul class="task-list">
        <li v-for="task in tasks" :key="task.id" class="task-row">
          <button
            class="checkbox"
            :class="{
              done: task.status === 'done',
              'checkbox-disabled': isReadOnly && task.status === 'open'
            }"
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

      <!-- The ✓ in the folded corner: go back to the board. Not on locked post-its. -->
      <button
        v-if="!isReadOnly"
        class="fold-corner"
        aria-label="Done for now"
        title="Done for now - pin back to the board"
        @click="doneForNow"
      >
        <CheckIcon />
      </button>

      <!-- Send this post-it's unfinished tasks to tomorrow. -->
      <button
        v-if="!isReadOnly && hasOpenTasks"
        class="next-day-button"
        :disabled="isMovingToNextDay"
        title="Move the unfinished tasks on this post-it to tomorrow"
        @click="moveOpenTasksToNextDay"
      >
        {{ isMovingToNextDay ? 'moving…' : 'move this to the next day →' }}
      </button>
      <p v-if="movedMessage" class="moved-message">{{ movedMessage }}</p>
    </div>

    <!-- The happy bee that pops up when you tick the last task. -->
    <div v-if="isCelebrating" class="celebration-bee">
      <Bee :key="celebrationKey" :size="90" mood="happy" />
    </div>

    <!-- "Move this task to today?" popup, for re-opening a task on an old post-it -->
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
  border: var(--outline-width-thick) solid var(--color-note-border);
  border-radius: var(--radius-note);
  padding: 28px 24px 60px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition:
    transform 0.32s ease-in,
    opacity 0.32s ease-in;
}

.note-flying-back {
  transform: scale(0.15) translateY(-260px);
  opacity: 0;
}

.note-title {
  text-align: center;
  font-size: 1.5rem;
  cursor: text;
}

.note-title.readonly {
  cursor: default;
}

.note-title-input {
  font: inherit;
  font-family: var(--font-heading);
  font-size: 1.5rem;
  text-align: center;
  color: var(--color-text);
  background: #fff8ea;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 8px;
  padding: 2px 8px;
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

.next-day-button {
  position: absolute;
  top: -16px;
  right: 10px;
  z-index: 15;
  padding: 5px 12px;
  border-radius: 999px;
  border: var(--outline-width) solid var(--color-ink);
  background: var(--color-honey);
  color: var(--color-text);
  font-family: var(--font-heading);
  font-size: 0.75rem;
  box-shadow: 2px 3px 0 var(--color-ink);
  transform: rotate(2deg);
  cursor: pointer;
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease;
}

.next-day-button:hover:not(:disabled) {
  transform: rotate(2deg) translateY(-1px);
  box-shadow: 3px 4px 0 var(--color-ink);
}

.next-day-button:active:not(:disabled) {
  transform: rotate(2deg) translate(2px, 3px);
  box-shadow: 0 0 0 var(--color-ink);
}

.next-day-button:disabled {
  opacity: 0.7;
  cursor: default;
}

.moved-message {
  position: absolute;
  top: 16px;
  right: 14px;
  z-index: 15;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.move-confirm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(43, 38, 34, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 20;
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

/* The "good job" stamp: big, slightly tilted like a real rubber stamp, and
   drawn on top of the tasks. Clicks go straight through it, so the tasks
   underneath can still be clicked. */
.good-job-stamp {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 70%;
  max-height: 70%;
  object-fit: contain;
  transform: translate(-50%, -50%) rotate(-8deg);
  pointer-events: none;
  z-index: 10;
}

/* The happy bee floats above the post-it, so its bouncing doesn't push
   anything else around. */
.celebration-bee {
  position: absolute;
  top: 18%;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 30;
}
</style>
