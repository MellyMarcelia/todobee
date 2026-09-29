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
// The one message this screen sends up to App.vue: "go back to the board".
const emit = defineEmits<{ back: [] }>()

// The post-it and its tasks, once loaded. Empty until then.
const note = ref<Note | null>(null)
const tasks = ref<Task[]>([])
// If loading goes wrong, the problem is kept here and shown on screen.
const loadError = ref<string | null>(null)

// Old post-its are locked, so most buttons are switched off for them.
const isReadOnly = computed(() => note.value?.sealed ?? false)

// What you're typing in the "tap to add…" box, and whether that box is open.
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
    // The post-it doesn't exist (maybe it was deleted) - say so.
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

// Load it as soon as the screen opens.
onMounted(loadNote)

// True only while developing - used to show the post-it's date for testing.
const isDev = import.meta.env.DEV

// The "move this to the next day" button. Sends this post-it's unfinished
// tasks to the same post-it tomorrow. This post-it stays open today with its
// finished tasks. The button only shows when there's something unfinished.
const hasOpenTasks = computed(() => tasks.value.some((t) => t.status === 'open'))
// True while the move is happening (the button says "moving…").
const isMovingToNextDay = ref(false)
// The little "2 tasks moved to tomorrow" message, and the timer that hides it.
const movedMessage = ref<string | null>(null)
let movedMessageTimeout: ReturnType<typeof setTimeout> | undefined
// After moving tasks away, only finished ones are left, which looks like
// "all done". But putting things off isn't finishing them, so no celebration.
let skipNextCelebration = false

async function moveOpenTasksToNextDay(): Promise<void> {
  // Ignore extra clicks while a move is already happening.
  if (!note.value || isMovingToNextDay.value) return
  isMovingToNextDay.value = true
  try {
    const movedCount = await window.api.moveOpenTasksToNextDay(note.value.id)
    // Reload the task list (only finished ones are left now), with the
    // celebration switched off just for this moment.
    skipNextCelebration = true
    tasks.value = await window.api.listTasks(note.value.id)
    await nextTick()
    skipNextCelebration = false
    // Show "N tasks moved to tomorrow" for 2.5 seconds, then hide it.
    movedMessage.value = `${movedCount} task${movedCount === 1 ? '' : 's'} moved to tomorrow`
    clearTimeout(movedMessageTimeout)
    movedMessageTimeout = setTimeout(() => {
      movedMessage.value = null
    }, 2500)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to move tasks to the next day:', error)
  } finally {
    // Worked or not, the button goes back to normal.
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

  // Tidy up extra spaces, and clear the box for next time.
  const title = newTaskTitle.value.trim()
  newTaskTitle.value = ''
  if (!title || !note.value) return

  // Save it, then add it to the bottom of the list on screen.
  const created = await window.api.createTask(note.value.id, { title })
  tasks.value.push(created)
}

// Ticks or un-ticks a task.
async function toggleTaskStatus(task: Task): Promise<void> {
  // Flip it: not done becomes done, done becomes not done.
  const nextStatus = task.status === 'open' ? 'done' : 'open'
  const updated = await window.api.setTaskStatus(task.id, nextStatus)
  // Swap the old version of the task on screen for the saved one.
  const index = tasks.value.findIndex((t) => t.id === task.id)
  if (index !== -1) tasks.value[index] = updated
}

// On a locked old post-it, the only thing you can do is un-tick a finished
// task. That asks "move this task to today?" before doing anything.
// Everything else (adding, editing, deleting) is switched off.
// The task waiting for a yes/no answer (the popup shows while this is set).
const taskPendingMove = ref<Task | null>(null)

// What happens when you click a tick box: on a locked post-it, ask about
// moving the task; otherwise just tick/un-tick it.
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

// You said no in the popup - close it, nothing changes.
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
  // Swap the old version of the task on screen for the saved one.
  const index = tasks.value.findIndex((t) => t.id === task.id)
  if (index !== -1) tasks.value[index] = updated
}

// The ✕ next to a task - delete it.
async function removeTask(task: Task): Promise<void> {
  if (isReadOnly.value) return
  await window.api.deleteTask(task.id)
  // Take it off the list on screen too.
  tasks.value = tasks.value.filter((t) => t.id !== task.id)
}

// The ✓ in the folded corner ("done for now"). It doesn't finish or delete
// anything - it just sends the post-it back to the board, with a short
// fly-away animation first.
const isFlyingBack = ref(false)

function doneForNow(): void {
  // Ignore extra clicks while it's already flying away.
  if (isFlyingBack.value) return
  // Start the animation, then go back once it's finished (0.32 seconds).
  isFlyingBack.value = true
  setTimeout(() => emit('back'), 320)
}

// Click the post-it's name to rename it (not on locked old post-its).
// Is the name being edited right now? And what's typed in the box so far.
const isEditingTitle = ref(false)
const editingNoteTitle = ref('')

// You clicked the name - swap it for a text box with the current name in it.
function startEditingTitle(): void {
  if (isReadOnly.value || !note.value) return
  isEditingTitle.value = true
  editingNoteTitle.value = note.value.title
}

// Done renaming (Enter or click away) - save it, unless it's empty or
// unchanged. Like tasks, this guards against saving twice.
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

// Every time "all done or not" changes: if it just flipped to "all done"
// (and it's not the moment of loading, or of moving tasks to tomorrow),
// show the happy bee for 0.9 seconds.
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
    <!-- The ‹ arrow in the top-left corner: back to the board. -->
    <button class="back-arrow" aria-label="Back to board" @click="$emit('back')">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 5 L7 12 L15 19" />
      </svg>
    </button>

    <!-- If loading failed: say so, show what went wrong, and offer a Retry button. -->
    <div v-if="loadError" class="load-error">
      <p>Couldn't load this note.</p>
      <p class="load-error-detail">{{ loadError }}</p>
      <button class="load-error-retry" @click="loadNote">Retry</button>
    </div>

    <!-- The big post-it itself (grey if it's old and locked). -->
    <div
      v-else-if="note"
      class="note"
      :class="{ 'note-flying-back': isFlyingBack }"
      :style="{
        background: isReadOnly ? 'var(--color-note-past)' : note.colour,
        borderColor: 'var(--color-note-border)'
      }"
    >
      <!-- The post-it's name. While renaming it's a text box, otherwise
           it's a heading you can click. -->
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
      <!-- A small "read-only history" label on locked post-its, and the
           date (only while developing). -->
      <p v-if="isReadOnly" class="note-readonly-badge">read-only history</p>
      <p v-if="isDev" class="note-date-debug">{{ note.noteDate }}</p>

      <!-- The "good job" stamp, shown once every task is done. -->
      <img v-if="isPerfectDay" :src="goodJobStamp" alt="Good job stamp" class="good-job-stamp" />

      <!-- The list of tasks. -->
      <ul class="task-list">
        <!-- One row per task: tick box, text, and a ✕ to delete. -->
        <li v-for="task in tasks" :key="task.id" class="task-row">
          <!-- The tick box. Green with a ✓ when done. On a locked post-it,
               the not-done ones are faded and can't be clicked. -->
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

          <!-- The task's text. While editing it's a text box, otherwise
               plain text you can click (crossed out once done). -->
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

          <!-- The ✕ delete button. Shows up when you hover the row. -->
          <button
            v-if="!isReadOnly"
            class="delete-button"
            aria-label="Delete task"
            @click="removeTask(task)"
          >
            ✕
          </button>
        </li>

        <!-- The last row: "tap to add…". Click it and it becomes a text box
             for a new task. Not shown on locked post-its. -->
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
      <!-- The short "N tasks moved to tomorrow" message. -->
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
/* The whole screen: brown background, with the post-it in the middle. */
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

/* The ‹ back button in the top-left corner. */
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

/* The arrow drawing fills its button. */
.back-arrow svg {
  width: 100%;
  height: 100%;
}

/* The arrow is drawn as a thick, rounded cream line. */
.back-arrow path {
  fill: none;
  stroke: var(--color-cream);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* The "Couldn't load this note" card. Same size and shape as a post-it, so the screen doesn't
   jump around. */
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

/* The smaller, faded text saying what went wrong. */
.load-error-detail {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  word-break: break-word;
}

/* The Retry button. */
.load-error-retry {
  padding: 8px 18px;
  border-radius: 8px;
  border: var(--outline-width) solid var(--color-ink);
  background: #fff8ea;
  color: var(--color-text);
  cursor: pointer;
}

/* The big post-it. (Its colour is set in the page layout above.) The extra space at the bottom
   leaves room for the folded ✓ corner. "transition" makes the fly-away animation smooth instead
   of instant. */
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

/* The fly-away: shrink small, float up, and fade out. */
.note-flying-back {
  transform: scale(0.15) translateY(-260px);
  opacity: 0;
}

/* The post-it's name, big and centred. The text cursor hints you can click it to edit. */
.note-title {
  text-align: center;
  font-size: 1.5rem;
  cursor: text;
}

/* On locked post-its, the normal arrow cursor (you can't edit). */
.note-title.readonly {
  cursor: default;
}

/* The text box that replaces the name while renaming. Same size text, so nothing jumps. */
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

/* The small "read-only history" label, pulled up close under the name. */
.note-readonly-badge {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: -14px;
}

/* The date, shown only while developing. */
.note-date-debug {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: -12px;
}

/* The list of tasks, one under the other, with space between. */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* One task row: tick box, text and ✕ side by side. */
.task-row {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

/* Hovering a row makes its ✕ appear and become clickable. */
.task-row:hover .delete-button {
  opacity: 1;
  pointer-events: auto;
}

/* The tick box: a small rounded square with a dark outline. */
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

/* A ticked box turns green with a white ✓. */
.checkbox.done {
  background: var(--color-check-green);
  color: var(--color-check-tick);
}

/* On locked post-its, the boxes of unfinished tasks are faded and can't be clicked. */
.checkbox.checkbox-disabled {
  cursor: default;
  opacity: 0.6;
}

/* The dashed, faded box next to "tap to add…". It's just for looks. */
.checkbox.placeholder-checkbox {
  border-style: dashed;
  opacity: 0.5;
  cursor: default;
}

/* A task's text. It stretches to fill the rest of the row. */
.task-text {
  font-size: 1.05rem;
  color: var(--color-text);
  flex: 1;
  cursor: text;
}

/* On locked post-its, the normal arrow cursor (you can't edit). */
.task-text.readonly {
  cursor: default;
}

/* Finished tasks are faded and crossed out. */
.task-text.done {
  color: var(--color-text-muted);
  text-decoration: line-through;
}

/* The faded "tap to add…" text. */
.task-text.muted {
  color: var(--color-text-muted);
  font-weight: 400;
}

/* The text box for writing or editing a task. */
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

/* The ✕ at the end of a task row. Invisible (and not clickable) until you hover the row. */
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

/* The "tap to add…" row is a bit faded. */
.add-row {
  opacity: 0.7;
}

/* The ✓ "done for now" button, shaped like a folded-up corner in the bottom-right. */
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

/* The "move this to the next day →" button: a honey-coloured pill, slightly tilted, sticking
   out over the top edge of the post-it, with a solid shadow like a sticker. */
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

/* On hover, it lifts up a little. */
.next-day-button:hover:not(:disabled) {
  transform: rotate(2deg) translateY(-1px);
  box-shadow: 3px 4px 0 var(--color-ink);
}

/* While pressed, it sinks down onto its shadow, like a real button. */
.next-day-button:active:not(:disabled) {
  transform: rotate(2deg) translate(2px, 3px);
  box-shadow: 0 0 0 var(--color-ink);
}

/* While moving, it's faded and can't be clicked. */
.next-day-button:disabled {
  opacity: 0.7;
  cursor: default;
}

/* The small "N tasks moved to tomorrow" text, just under that button. */
.moved-message {
  position: absolute;
  top: 16px;
  right: 14px;
  z-index: 15;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

/* The dark see-through layer behind the "Move this task to today?" popup, covering the whole
   screen. */
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

/* The popup card itself. */
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

/* The task's name in the popup, faded. */
.move-confirm-title {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

/* The row of buttons at the bottom of the popup. */
.move-confirm-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 6px;
}

/* The shape both popup buttons share. */
.move-confirm-yes,
.move-confirm-no {
  padding: 8px 14px;
  border-radius: 8px;
  border: var(--outline-width) solid var(--color-ink);
  cursor: pointer;
  font-family: var(--font-heading);
}

/* "Move to today" is green. */
.move-confirm-yes {
  background: var(--color-check-green);
  color: #fff8ea;
}

/* "Cancel" is plain, with no fill. */
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
