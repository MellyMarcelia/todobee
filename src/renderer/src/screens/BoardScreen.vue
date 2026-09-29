<script setup lang="ts">
// The home screen: the corkboard. It shows every post-it for one day. You
// can flip between days with ‹ ›, drag post-its around, add or delete
// them, and click one to open it.
import { ref, onMounted, watch, nextTick } from 'vue'
import Bee from '../components/Bee.vue'
import PinIcon from '../components/icons/PinIcon.vue'
import GearIcon from '../components/icons/GearIcon.vue'
import goodJobStamp from '../assets/stamps/good-job-stamp.png'
import type { VaultStatus, DayResult, BoardNote } from '../../../shared/types'

// The messages this screen can send up to App.vue: "open this post-it" and
// "open Settings".
const emit = defineEmits<{ open: [noteId: number]; 'open-settings': [] }>()

// Which day we're looking at, counted from today: 0 is today, -1 is
// yesterday, 1 is tomorrow, and so on.
const dayOffset = ref(0)
// Everything we loaded for that day (its post-its, date label...). Empty
// (null) until it has loaded.
const day = ref<DayResult | null>(null)
// If loading goes wrong, the problem is kept here and shown on screen.
const loadError = ref<string | null>(null)

// Loads the post-its for the day we're looking at.
async function loadDay(): Promise<void> {
  loadError.value = null
  try {
    day.value = await window.api.getDayForOffset(dayOffset.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to load day:', error)
  }
}

// Load once on open, and again every time you flip to another day.
onMounted(loadDay)
watch(dayOffset, loadDay)

// The ‹ › arrows. Changing the day is enough - the line above reloads the board.
// ‹ goes back one day...
function previousDay(): void {
  dayOffset.value -= 1
}

// ...and › goes forward one day.
function nextDay(): void {
  dayOffset.value += 1
}

// ---- Dragging post-its around ----
// A post-it only counts as "dragged" once the mouse moves more than a few
// pixels. A smaller wobble still counts as a click, which opens it.
const DRAG_THRESHOLD_PX = 4
// The area of the board where post-its sit. We need it to know how big it
// is, so post-its can't be dragged off the edge.
const notesAreaRef = ref<HTMLElement | null>(null)

// What we remember about a drag while it's happening.
interface DragState {
  // Which post-it is being dragged.
  noteId: number
  // Which mouse/finger is doing the dragging.
  pointerId: number
  // Where the mouse was when you pressed down.
  startClientX: number
  startClientY: number
  // Where the post-it was when you pressed down.
  startLeft: number
  startTop: number
  // Has it moved far enough to count as a drag (not a click)?
  moved: boolean
}

// Info about the drag that's happening right now, if any.
const dragState = ref<DragState | null>(null)
// Where each post-it is while (and just after) you drag it.
const livePositions = ref<Record<number, { x: number; y: number }>>({})

// Where a post-it goes if you've never moved it. Each one sits a little
// lower and to the right of the one before, so they don't all stack up.
function defaultPosition(index: number): { x: number; y: number } {
  return { x: 20 + index * 34, y: 20 + index * 34 }
}

// Where should this post-it sit? Mid-drag spot first, then its saved spot,
// then the default spot if it's never been moved.
function positionFor(note: BoardNote, index: number): { x: number; y: number } {
  const live = livePositions.value[note.id]
  if (live) return live
  if (note.boardX !== null && note.boardY !== null) return { x: note.boardX, y: note.boardY }
  return defaultPosition(index)
}

// Mouse button pressed on a post-it - remember where everything started.
// The drag keeps working even if the mouse slips off the post-it.
function startDrag(event: PointerEvent, note: BoardNote, index: number): void {
  const current = positionFor(note, index)
  dragState.value = {
    noteId: note.id,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startLeft: current.x,
    startTop: current.y,
    moved: false
  }
  // "Hold on" to the mouse, so the post-it keeps following it.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

// Mouse is moving - slide the post-it along, but keep it on the board.
function onDragMove(event: PointerEvent): void {
  const drag = dragState.value
  // Not dragging right now (or it's a different mouse/finger)? Ignore it.
  if (!drag || event.pointerId !== drag.pointerId) return

  // How far the mouse has moved since you pressed down.
  const dx = event.clientX - drag.startClientX
  const dy = event.clientY - drag.startClientY
  // Still just a tiny wobble? Don't move anything yet.
  if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return
  drag.moved = true

  // The furthest right and down a post-it can go and still be on the
  // board (the post-it is about 120 pixels big, edges included).
  const areaRect = notesAreaRef.value?.getBoundingClientRect()
  const maxX = areaRect ? areaRect.width - 120 : 9999
  const maxY = areaRect ? areaRect.height - 120 : 9999

  // Move the post-it by the same amount the mouse moved, but never past
  // the edges of the board.
  livePositions.value = {
    ...livePositions.value,
    [drag.noteId]: {
      x: Math.min(Math.max(drag.startLeft + dx, 0), maxX),
      y: Math.min(Math.max(drag.startTop + dy, 0), maxY)
    }
  }
}

// Mouse button released - if it barely moved it was a click (open the
// post-it), otherwise save the new spot so it stays there next time.
async function endDrag(event: PointerEvent, note: BoardNote, index: number): Promise<void> {
  const drag = dragState.value
  if (!drag || event.pointerId !== drag.pointerId) return
  // The drag is over, so forget about it.
  dragState.value = null

  if (!drag.moved) {
    // A click, not a drag - open the post-it.
    emit('open', note.id)
    return
  }

  // A real drag - save where it ended up.
  const final = positionFor(note, index)
  try {
    await window.api.setNotePosition(note.id, final.x, final.y)
  } catch (error) {
    console.error('Failed to save note position:', error)
  }
}

// ---- Vault warning ----
// Shows a warning if no Obsidian folder is picked yet, or if it can't be
// found any more. The app still works either way - it's just a reminder.
const vaultStatus = ref<VaultStatus | null>(null)

// Asks which folder is saved and whether it's still there.
async function loadVaultStatus(): Promise<void> {
  try {
    vaultStatus.value = await window.api.getVaultStatus()
  } catch (error) {
    console.error('Failed to load vault status:', error)
  }
}

// Check once, when the board opens.
onMounted(loadVaultStatus)

// When you switch days, forget any drag positions from the previous day.
watch(day, () => {
  nextTick(() => {
    livePositions.value = {}
  })
})

// ---- Adding a post-it ----
// The "+ new post-it" button. Works on today and future days (past days
// are locked). Pick a colour, type a name, and it appears on the board.

// The colours you can choose from.
const NEW_NOTE_COLORS = ['#F6C56A', '#E76F51', '#4A90D9', '#E9A23B', '#7FB069']
// The magnet on each post-it is always a different colour from the post-it,
// so it stands out. This table says which magnet colour goes with which
// post-it colour.
const PIN_COLOR_FOR_NOTE: Record<string, string> = {
  '#F6C56A': '#E76F51',
  '#E76F51': '#4A90D9',
  '#4A90D9': '#E9A23B',
  '#E9A23B': '#4A90D9',
  '#7FB069': '#E76F51'
}

// Picks the magnet colour for a post-it using the table above. For a colour
// not in the table, use red - or blue if the post-it is already red.
function pinColorFor(noteColour: string): string {
  const pin = PIN_COLOR_FOR_NOTE[noteColour.toUpperCase()]
  if (pin) return pin
  return noteColour.toUpperCase() === '#E76F51' ? '#4A90D9' : '#E76F51'
}

// Is the "new post-it" form open? And what's typed/picked in it so far.
const isAddingNote = ref(false)
const newNoteTitle = ref('')
const newNoteColour = ref(NEW_NOTE_COLORS[0])

// "+ new post-it" clicked - open a fresh, empty form (first colour picked).
function startAddingNote(): void {
  isAddingNote.value = true
  newNoteTitle.value = ''
  newNoteColour.value = NEW_NOTE_COLORS[0]
}

// "Cancel" in the form - just close it, nothing is saved.
function cancelAddingNote(): void {
  isAddingNote.value = false
}

// The (?) help button: opens a small card explaining how the board works.
const isHelpOpen = ref(false)

// ---- Deleting a post-it ----
// The ✕ on a post-it asks "are you sure?" first, since all its tasks get
// deleted too. Old, locked post-its don't have a ✕.
// The post-it waiting for a yes/no answer (the popup shows while this is set).
const notePendingDelete = ref<BoardNote | null>(null)
// If deleting goes wrong, the problem is kept here and shown on screen.
const deleteError = ref<string | null>(null)

// ✕ clicked - show the "are you sure?" popup for this post-it.
function askDeleteNote(note: BoardNote): void {
  notePendingDelete.value = note
}

// "Cancel" in the popup - close it, nothing is deleted.
function cancelDeleteNote(): void {
  notePendingDelete.value = null
}

// "Delete" in the popup - close it, delete the post-it, then reload the board.
async function confirmDeleteNote(): Promise<void> {
  const note = notePendingDelete.value
  if (!note) return
  notePendingDelete.value = null
  deleteError.value = null
  try {
    await window.api.deleteNote(note.id)
    await loadDay()
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to delete note:', error)
  }
}

// "Add" in the new post-it form - create it (needs a title), then reload the day.
async function confirmAddNote(): Promise<void> {
  const title = newNoteTitle.value.trim()
  if (!title) return
  try {
    await window.api.createNote(title, newNoteColour.value, dayOffset.value)
    isAddingNote.value = false
    await loadDay()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to create note:', error)
  }
}
</script>

<template>
  <div class="board-screen">
    <!-- The brown corkboard at the top, where the post-its are pinned. -->
    <section class="board">
      <!-- Top row: (?) help on the left, "to-do" in the middle, ⚙ settings on the right. -->
      <div class="board-header">
        <button class="help-button" aria-label="Help" @click="isHelpOpen = true">?</button>
        <h2 class="board-title">to-do</h2>
        <button class="settings-button" aria-label="Settings" @click="$emit('open-settings')">
          <GearIcon />
        </button>
      </div>

      <!-- The date, with ‹ › arrows to flip between days. -->
      <div class="day-nav">
        <button class="day-arrow" aria-label="Previous day" @click="previousDay">‹</button>
        <span class="day-label">{{ day?.dateLabel ?? '…' }}</span>
        <button class="day-arrow" aria-label="Next day" @click="nextDay">›</button>
      </div>

      <!-- Yellow warning boxes: no Obsidian folder picked, folder missing,
           or something went wrong loading/deleting. -->
      <p v-if="vaultStatus && !vaultStatus.path" class="warning-banner">
        Choose your Obsidian vault in Settings so your tasks get logged
      </p>
      <p v-else-if="vaultStatus && !vaultStatus.exists" class="warning-banner">
        Your vault folder can't be found, choose it again
      </p>
      <p v-if="loadError" class="warning-banner">Couldn't load this day: {{ loadError }}</p>
      <p v-if="deleteError" class="warning-banner">
        Couldn't delete that post-it: {{ deleteError }}
      </p>

      <!-- The space where the post-its sit. -->
      <div ref="notesAreaRef" class="notes-area">
        <!-- Each post-it plus its ✕ delete button, kept side by side.
             This repeats once for every post-it on the day, placed at its
             spot on the board. -->
        <div
          v-for="(note, index) in day?.notes ?? []"
          :key="note.id"
          class="pinned-note-wrap"
          :style="{
            left: `${positionFor(note, index).x}px`,
            top: `${positionFor(note, index).y}px`
          }"
        >
          <!-- The post-it itself: grey if it's old and locked, otherwise its
               own colour. Press, move and let go to drag it; a quick click opens it. -->
          <button
            class="pinned-note"
            :class="{ 'pinned-note-today': day?.isToday, 'pinned-note-past': note.sealed }"
            :style="{ background: note.sealed ? 'var(--color-note-past)' : note.colour }"
            @pointerdown="startDrag($event, note, index)"
            @pointermove="onDragMove"
            @pointerup="endDrag($event, note, index)"
          >
            <!-- The magnet on top, the small "good job" stamp (if every task
                 is done), the post-it's name, and how many tasks it has. -->
            <span class="pin"><PinIcon :color="pinColorFor(note.colour)" /></span>
            <img v-if="note.perfectDay" :src="goodJobStamp" alt="Good job" class="mini-stamp" />
            <span class="pinned-note-title">{{ note.title }}</span>
            <span class="pinned-note-task-count"
              >{{ note.taskCount }} task{{ note.taskCount === 1 ? '' : 's' }}</span
            >
          </button>
          <!-- The ✕ delete button. Only on post-its you can still change. -->
          <button
            v-if="!day?.isPast && !note.sealed"
            class="delete-note-button"
            :aria-label="`Delete post-it ${note.title}`"
            @click="askDeleteNote(note)"
          >
            ✕
          </button>
        </div>

        <!-- Shown when the day has no post-its at all. -->
        <p v-if="day && day.notes.length === 0" class="empty-day">Nothing here yet</p>
      </div>
    </section>

    <!-- the "?" help popup - click outside it or "Got it" to close -->
    <div v-if="isHelpOpen" class="delete-confirm-overlay" @click.self="isHelpOpen = false">
      <div class="delete-confirm-card help-card">
        <p class="delete-confirm-title">How Todobee works</p>
        <ul class="help-list">
          <li><strong>Open a post-it</strong> by clicking it; drag it to move it around.</li>
          <li><strong>+ new post-it</strong> (under the board) adds another one for today.</li>
          <li><strong>Hover a post-it</strong> and click ✕ to delete it with its tasks.</li>
          <li>
            On a post-it: <strong>tap to add…</strong> a task, tick the box to finish it, click its
            text to edit it, hover and click ✕ to delete it.
          </li>
          <li><strong>Click the title</strong> of a post-it to rename it.</li>
          <li>Finish every task and the bee celebrates with a <strong>Well Done</strong> stamp.</li>
          <li>
            <strong>Move this to the next day</strong> on a post-it sends its unfinished tasks to
            tomorrow; today's post-it stays open.
          </li>
          <li>
            Anything still unfinished at the end of the day moves over automatically; past days are
            gray and read-only.
          </li>
          <li>
            <strong>‹ ›</strong> browses any day, past or future; <strong>⚙</strong> picks your
            Obsidian vault.
          </li>
        </ul>
        <div class="delete-confirm-buttons">
          <button class="delete-confirm-no" @click="isHelpOpen = false">Got it</button>
        </div>
      </div>
    </div>

    <!-- "are you sure?" popup before a post-it gets deleted -->
    <div v-if="notePendingDelete" class="delete-confirm-overlay">
      <div class="delete-confirm-card">
        <p class="delete-confirm-title">Delete “{{ notePendingDelete.title }}”?</p>
        <!-- Only mention tasks if there are some. -->
        <p v-if="notePendingDelete.taskCount > 0" class="delete-confirm-detail">
          Its {{ notePendingDelete.taskCount }} task{{
            notePendingDelete.taskCount === 1 ? '' : 's'
          }}
          will be deleted too.
        </p>
        <div class="delete-confirm-buttons">
          <button class="delete-confirm-yes" @click="confirmDeleteNote">Delete</button>
          <button class="delete-confirm-no" @click="cancelDeleteNote">Cancel</button>
        </div>
      </div>
    </div>

    <!-- The cream "desk" area under the board. -->
    <section class="desk">
      <!-- "+ new post-it" button and form, under the board on the left.
           Hidden on past days. The button hides while the form is open. -->
      <button v-if="!day?.isPast && !isAddingNote" class="add-note-button" @click="startAddingNote">
        + new post-it
      </button>

      <div v-if="isAddingNote && !day?.isPast" class="add-note-form">
        <!-- Type the name here. Pressing Enter is the same as clicking "Add". -->
        <input
          v-model="newNoteTitle"
          class="add-note-title-input"
          type="text"
          placeholder="e.g. School, Personal…"
          @keyup.enter="confirmAddNote"
        />
        <!-- One round colour dot per choice. The picked one gets a ring. -->
        <div class="add-note-colors">
          <button
            v-for="colour in NEW_NOTE_COLORS"
            :key="colour"
            class="add-note-swatch"
            :class="{ selected: newNoteColour === colour }"
            :style="{ background: colour }"
            :aria-label="`Choose colour ${colour}`"
            @click="newNoteColour = colour"
          />
        </div>
        <!-- Add / Cancel buttons. -->
        <div class="add-note-buttons">
          <button class="add-note-confirm" @click="confirmAddNote">Add</button>
          <button class="add-note-cancel" @click="cancelAddingNote">Cancel</button>
        </div>
      </div>

      <!-- The bee, sitting in the bottom-right corner. -->
      <div class="bee-at-desk">
        <Bee :size="150" mood="idle" />
      </div>
    </section>
  </div>
</template>

<style scoped>
/* The whole board screen: fills the window, cream background, with the board on top and the
   desk underneath. */
.board-screen {
  position: relative;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-cream);
}

/* The brown corkboard. It takes up most of the height, and scrolls if there's too much in it. */
.board {
  flex: 1 1 55%;
  min-height: 0;
  margin: 20px 20px 0;
  padding: 20px 18px;
  background: var(--color-board);
  border: var(--outline-width-thick) solid var(--color-board-border);
  border-radius: var(--radius-board);
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

/* The top row: "to-do" in the middle, with the ? and ⚙ buttons tucked into the corners. */
.board-header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 24px;
}

/* The ⚙ settings button, in the top-right corner. */
.settings-button {
  position: absolute;
  right: 0;
  top: -2px;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #fff8ea;
  padding: 0;
  cursor: pointer;
}

/* The round (?) help button, in the top-left corner. */
.help-button {
  position: absolute;
  left: 0;
  top: -2px;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid #fff8ea;
  background: transparent;
  color: #fff8ea;
  font-family: var(--font-heading);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
}

/* The help popup: a bit wider than the delete popup, with the text lined up on the left. */
.help-card {
  max-width: 320px;
  text-align: left;
}

/* The list of tips inside the help popup. */
.help-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--color-text);
  font-size: 0.8rem;
  line-height: 1.35;
}

/* The help popup's heading stays centred. */
.help-card .delete-confirm-title {
  text-align: center;
}

/* The ‹ date › row, tucked up close under the title. */
.day-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: -14px;
}

/* The ‹ › arrows. */
.day-arrow {
  border: none;
  background: transparent;
  color: #fff8ea;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
}

/* How an arrow would look if it were switched off (faded). Not used right now. */
.day-arrow:disabled {
  opacity: 0.35;
  cursor: default;
}

/* The date between the arrows. It always takes up the same width, so the arrows don't jump
   around when the date gets longer or shorter. */
.day-label {
  font-size: 0.85rem;
  color: #fff8ea;
  min-width: 160px;
  text-align: center;
}

/* The pale yellow warning boxes (no folder picked, something went wrong...). */
.warning-banner {
  background: #fff3d6;
  border: var(--outline-width) solid var(--color-honey);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.75rem;
  color: var(--color-text);
  text-align: center;
}

/* The "to-do" title. */
.board-title {
  font-size: 1.1rem;
  text-align: center;
  color: #fff8ea;
}

/* The space where the post-its sit. Each post-it is placed inside it at an exact spot. */
.notes-area {
  position: relative;
  flex: 1;
  min-height: 340px;
}

/* The faded "Nothing here yet" text. */
.empty-day {
  color: rgba(255, 248, 234, 0.7);
  font-size: 0.8rem;
  text-align: center;
}

/* An invisible box holding one post-it and its ✕, placed at the post-it's spot on the board. */
.pinned-note-wrap {
  position: absolute;
  width: 100px;
  height: 100px;
}

/* Post-its can overlap. The one under your mouse is brought to the front,
   so its ✕ is never hidden. */
.pinned-note-wrap:hover,
.pinned-note-wrap:focus-within {
  z-index: 5;
}

/* A post-it on the board: a 100 x 100 square with a dark outline and its text in the middle.
   The open-hand cursor shows it can be dragged. */
.pinned-note {
  position: relative;
  width: 100px;
  height: 100px;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 8px;
  cursor: grab;
  padding: 18px 10px 10px;
  font: inherit;
  touch-action: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

/* While you hold it, the cursor becomes a closed "grabbing" hand. */
.pinned-note:active {
  cursor: grabbing;
}

/* Old post-its are greyed out, and so is their magnet. The "good job" stamp
   keeps its colour, so finished days still stand out. */
.pinned-note-past .pin {
  filter: grayscale(1);
  opacity: 0.6;
}

/* Old post-its get faded text too. */
.pinned-note-past .pinned-note-title,
.pinned-note-past .pinned-note-task-count {
  color: var(--color-text-muted);
}

/* Today's post-its. Same size as the rest for now; this is here in case today's should look
   different later. */
.pinned-note-today {
  width: 100px;
  height: 100px;
}

/* The magnet, sitting over the top edge of the post-it, in the middle. */
.pin {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
}

/* The post-it's name. */
.pinned-note-title {
  font-size: 0.8rem;
  font-family: var(--font-heading);
  color: var(--color-text);
  word-break: break-word;
}

/* The small "3 tasks" text under the name. */
.pinned-note-task-count {
  font-size: 0.65rem;
  color: var(--color-text-muted);
}

/* The small "good job" stamp, tilted in the bottom-right corner. Clicks go straight through it
   to the post-it. */
.mini-stamp {
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 28px;
  transform: rotate(-10deg);
  pointer-events: none;
}

/* The ✕ in the post-it's top-right corner. Invisible (and not clickable) until you hover the
   post-it; see the next rule. */
.delete-note-button {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

/* Hovering the post-it (or reaching the ✕ with the Tab key) fades the ✕ in. */
.pinned-note-wrap:hover .delete-note-button,
.delete-note-button:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

/* The dark see-through layer behind a popup, covering the whole screen. The popup card sits in
   the middle of it. */
.delete-confirm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(43, 38, 34, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 20;
}

/* The popup card itself (used for both "Delete?" and help). */
.delete-confirm-card {
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

/* The popup's heading. */
.delete-confirm-title {
  color: var(--color-text);
  font-family: var(--font-heading);
  font-size: 0.95rem;
}

/* The smaller, faded line under it ("Its 3 tasks will be deleted too."). */
.delete-confirm-detail {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

/* The row of buttons at the bottom of the popup. */
.delete-confirm-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 6px;
}

/* The shape both popup buttons share. */
.delete-confirm-yes,
.delete-confirm-no {
  padding: 8px 14px;
  border-radius: 8px;
  border: var(--outline-width) solid var(--color-ink);
  cursor: pointer;
  font-family: var(--font-heading);
}

/* "Delete" is red, so it's clear it's the serious one. */
.delete-confirm-yes {
  background: #e76f51;
  color: #fff8ea;
}

/* "Cancel" / "Got it" is plain, with no fill. */
.delete-confirm-no {
  background: transparent;
  color: var(--color-text);
}

/* The "+ new post-it" button, with a dashed outline, in the desk's top-left corner. */
.add-note-button {
  position: absolute;
  top: 12px;
  left: 20px;
  font-size: 0.75rem;
  font-family: var(--font-heading);
  padding: 8px 12px;
  border-radius: 10px;
  border: var(--outline-width) dashed var(--color-ink);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}

/* The new post-it form: a small cream card in the same spot as the button, on top of everything
   else on the desk. */
.add-note-form {
  position: absolute;
  top: 12px;
  left: 20px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fff8ea;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 12px;
  padding: 12px;
  width: 200px;
}

/* The name text box. */
.add-note-title-input {
  font: inherit;
  font-size: 0.85rem;
  padding: 6px 8px;
  border-radius: 6px;
  border: var(--outline-width) solid var(--color-ink);
  color: var(--color-text);
}

/* The row of colour dots. */
.add-note-colors {
  display: flex;
  gap: 6px;
}

/* One round colour dot. */
.add-note-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: var(--outline-width) solid var(--color-ink);
  cursor: pointer;
  padding: 0;
}

/* The picked colour gets a ring around it. */
.add-note-swatch.selected {
  outline: 2px solid var(--color-text);
  outline-offset: 2px;
}

/* The Add / Cancel row. */
.add-note-buttons {
  display: flex;
  gap: 8px;
}

/* The shape both buttons share. They split the row equally. */
.add-note-confirm,
.add-note-cancel {
  flex: 1;
  padding: 6px 8px;
  font-size: 0.75rem;
  border-radius: 8px;
  border: var(--outline-width) solid var(--color-ink);
  cursor: pointer;
  font-family: var(--font-heading);
}

/* "Add" is green. */
.add-note-confirm {
  background: var(--color-check-green);
  color: #fff8ea;
}

/* "Cancel" is plain. */
.add-note-cancel {
  background: transparent;
  color: var(--color-text);
}

/* The cream desk under the board. It has a fixed height, and anything poking out of it is cut
   off. */
.desk {
  position: relative;
  flex: 0 0 220px;
  overflow: hidden;
}

/* The bee, sitting in the bottom-right corner of the desk. */
.bee-at-desk {
  position: absolute;
  right: 24px;
  bottom: 12px;
}
</style>
