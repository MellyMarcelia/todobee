<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import Bee from '../components/Bee.vue'
import PinIcon from '../components/icons/PinIcon.vue'
import GearIcon from '../components/icons/GearIcon.vue'
import goodJobStamp from '../assets/stamps/good-job-stamp.png'
import type { VaultStatus, DayResult, BoardNote } from '../../../shared/types'

// TL;DR: the home screen - the corkboard. It shows every post-it for one
// day, lets you flip between days with ‹ ›, drag post-its around, add or
// delete them, and click one to open it.

const emit = defineEmits<{ open: [noteId: number]; 'open-settings': [] }>()

// Milestone 7 (revised) + 9: history board, one day at a time. dayOffset 0
// is today, negative is the past, positive is the future - the main process
// does all the date math (see notes:getForDay in main/index.ts), so the
// renderer only ever counts days back and forth.
// Milestone 8b: a day can have several post-its now (day.notes is a list),
// each with its own task count for the "N tasks" label.
const dayOffset = ref(0)
const day = ref<DayResult | null>(null)
const loadError = ref<string | null>(null)

// Ask the backstage for the post-its on whichever day we're looking at.
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

// The ‹ › arrows. Changing dayOffset is enough - the watch above reloads.
function previousDay(): void {
  dayOffset.value -= 1
}

function nextDay(): void {
  dayOffset.value += 1
}

// Milestone 7 follow-up: dragging a note around the board. It gets an
// absolute pixel position within `.notes-area` - either a saved
// boardX/boardY from SQLite (if the user has dragged it before) or a
// computed default spot. Dragging uses plain pointer events (no library
// needed) with a small movement threshold so a quick click still opens the
// note instead of being eaten by the drag handler.
const DRAG_THRESHOLD_PX = 4
const notesAreaRef = ref<HTMLElement | null>(null)

interface DragState {
  noteId: number
  pointerId: number
  startClientX: number
  startClientY: number
  startLeft: number
  startTop: number
  moved: boolean
}

const dragState = ref<DragState | null>(null)
// Live position shown while dragging/after a drag, keyed by note id - kept
// separate from the note's own boardX/boardY so we don't have to mutate the
// props-like `note` object directly.
const livePositions = ref<Record<number, { x: number; y: number }>>({})

// Milestone 8b: several post-its can be on the board at once, so their
// default (never-dragged) positions are staggered instead of stacking on
// top of each other - a simple diagonal cascade, offset by the note's
// position in the day's list.
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

// Mouse went down on a post-it - remember where everything started.
// Pointer capture keeps the drag going even if the mouse slips off the note.
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
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

// Mouse is moving - slide the post-it along, but keep it inside the board.
function onDragMove(event: PointerEvent): void {
  const drag = dragState.value
  if (!drag || event.pointerId !== drag.pointerId) return

  const dx = event.clientX - drag.startClientX
  const dy = event.clientY - drag.startClientY
  if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return
  drag.moved = true

  const areaRect = notesAreaRef.value?.getBoundingClientRect()
  const maxX = areaRect ? areaRect.width - 120 : 9999
  const maxY = areaRect ? areaRect.height - 120 : 9999

  livePositions.value = {
    ...livePositions.value,
    [drag.noteId]: {
      x: Math.min(Math.max(drag.startLeft + dx, 0), maxX),
      y: Math.min(Math.max(drag.startTop + dy, 0), maxY)
    }
  }
}

// Mouse let go - if it barely moved it was a click (open the note),
// otherwise save the new spot so it stays there next time.
async function endDrag(event: PointerEvent, note: BoardNote, index: number): Promise<void> {
  const drag = dragState.value
  if (!drag || event.pointerId !== drag.pointerId) return
  dragState.value = null

  if (!drag.moved) {
    // A click, not a drag - open the note as usual.
    emit('open', note.id)
    return
  }

  const final = positionFor(note, index)
  try {
    await window.api.setNotePosition(note.id, final.x, final.y)
  } catch (error) {
    console.error('Failed to save note position:', error)
  }
}

// Milestone 5: show a warning banner when no vault is chosen yet, or when
// the previously-chosen vault folder can no longer be found. The app still
// works normally either way - this is just a nudge to visit Settings.
const vaultStatus = ref<VaultStatus | null>(null)

async function loadVaultStatus(): Promise<void> {
  try {
    vaultStatus.value = await window.api.getVaultStatus()
  } catch (error) {
    console.error('Failed to load vault status:', error)
  }
}

onMounted(loadVaultStatus)

// Reset drag-in-progress live positions when the day changes, so an old
// drag from a different day's note (now unmounted) can't leak in.
watch(day, () => {
  nextTick(() => {
    livePositions.value = {}
  })
})

// Milestone 8b + 9: "+ new post-it". Available on today and any future day
// (you can't add a post-it to a sealed, read-only past day). Picking a colour + typing a
// title creates the note, then the day is reloaded so it shows up pinned.
const NEW_NOTE_COLORS = ['#F6C56A', '#E76F51', '#4A90D9', '#E9A23B', '#7FB069']
// The hexagon magnet pinning each post-it is always a different colour from
// the post-it itself, so it stands out instead of blending in. Each post-it
// colour gets a contrasting magnet colour; anything unexpected (e.g. an old
// note with a colour no longer in the picker) falls back to red, or blue if
// the note is already red.
const PIN_COLOR_FOR_NOTE: Record<string, string> = {
  '#F6C56A': '#E76F51',
  '#E76F51': '#4A90D9',
  '#4A90D9': '#E9A23B',
  '#E9A23B': '#4A90D9',
  '#7FB069': '#E76F51'
}

// Picks the magnet colour for a post-it using the table above.
function pinColorFor(noteColour: string): string {
  const pin = PIN_COLOR_FOR_NOTE[noteColour.toUpperCase()]
  if (pin) return pin
  return noteColour.toUpperCase() === '#E76F51' ? '#4A90D9' : '#E76F51'
}

const isAddingNote = ref(false)
const newNoteTitle = ref('')
const newNoteColour = ref(NEW_NOTE_COLORS[0])

function startAddingNote(): void {
  isAddingNote.value = true
  newNoteTitle.value = ''
  newNoteColour.value = NEW_NOTE_COLORS[0]
}

function cancelAddingNote(): void {
  isAddingNote.value = false
}

// Help (?) button next to the title: a small card explaining how the board
// and post-its work. Purely informational - closing it changes nothing.
const isHelpOpen = ref(false)

// Deleting a whole post-it: the ✕ on one of today's pins asks for
// confirmation first (it takes every task on the post-it with it), then
// reloads the day. Past days are read-only, so their pins have no ✕.
const notePendingDelete = ref<BoardNote | null>(null)
const deleteError = ref<string | null>(null)

function askDeleteNote(note: BoardNote): void {
  notePendingDelete.value = note
}

function cancelDeleteNote(): void {
  notePendingDelete.value = null
}

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
    <section class="board">
      <div class="board-header">
        <button class="help-button" aria-label="Help" @click="isHelpOpen = true">?</button>
        <h2 class="board-title">to-do</h2>
        <button class="settings-button" aria-label="Settings" @click="$emit('open-settings')">
          <GearIcon />
        </button>
      </div>

      <div class="day-nav">
        <button class="day-arrow" aria-label="Previous day" @click="previousDay">‹</button>
        <span class="day-label">{{ day?.dateLabel ?? '…' }}</span>
        <button class="day-arrow" aria-label="Next day" @click="nextDay">›</button>
      </div>

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

      <div ref="notesAreaRef" class="notes-area">
        <!-- Each pin is wrapped so the delete ✕ can sit beside the note's
             own <button> (a button can't contain another button). -->
        <div
          v-for="(note, index) in day?.notes ?? []"
          :key="note.id"
          class="pinned-note-wrap"
          :style="{
            left: `${positionFor(note, index).x}px`,
            top: `${positionFor(note, index).y}px`
          }"
        >
          <button
            class="pinned-note"
            :class="{ 'pinned-note-today': day?.isToday, 'pinned-note-past': note.sealed }"
            :style="{ background: note.sealed ? 'var(--color-note-past)' : note.colour }"
            @pointerdown="startDrag($event, note, index)"
            @pointermove="onDragMove"
            @pointerup="endDrag($event, note, index)"
          >
            <span class="pin"><PinIcon :color="pinColorFor(note.colour)" /></span>
            <img v-if="note.perfectDay" :src="goodJobStamp" alt="Good job" class="mini-stamp" />
            <span class="pinned-note-title">{{ note.title }}</span>
            <span class="pinned-note-task-count"
              >{{ note.taskCount }} task{{ note.taskCount === 1 ? '' : 's' }}</span
            >
          </button>
          <button
            v-if="!day?.isPast && !note.sealed"
            class="delete-note-button"
            :aria-label="`Delete post-it ${note.title}`"
            @click="askDeleteNote(note)"
          >
            ✕
          </button>
        </div>

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

    <section class="desk">
      <!-- Milestone 8b + 9: "+ new post-it" - on today or any future day
           being browsed; past days are read-only history. Sits just under
           the board, on the left. -->
      <button v-if="!day?.isPast && !isAddingNote" class="add-note-button" @click="startAddingNote">
        + new post-it
      </button>

      <div v-if="isAddingNote && !day?.isPast" class="add-note-form">
        <input
          v-model="newNoteTitle"
          class="add-note-title-input"
          type="text"
          placeholder="e.g. School, Personal…"
          @keyup.enter="confirmAddNote"
        />
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
        <div class="add-note-buttons">
          <button class="add-note-confirm" @click="confirmAddNote">Add</button>
          <button class="add-note-cancel" @click="cancelAddingNote">Cancel</button>
        </div>
      </div>

      <!-- bee sitting at the desk, bottom-right.
           Laptop/stationery/desk removed for now - to be redesigned later. -->
      <div class="bee-at-desk">
        <Bee :size="150" mood="idle" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.board-screen {
  position: relative;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-cream);
}

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

.board-header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 24px;
}

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

.help-card {
  max-width: 320px;
  text-align: left;
}

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

.help-card .delete-confirm-title {
  text-align: center;
}

.day-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: -14px;
}

.day-arrow {
  border: none;
  background: transparent;
  color: #fff8ea;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
}

.day-arrow:disabled {
  opacity: 0.35;
  cursor: default;
}

.day-label {
  font-size: 0.85rem;
  color: #fff8ea;
  min-width: 160px;
  text-align: center;
}

.warning-banner {
  background: #fff3d6;
  border: var(--outline-width) solid var(--color-honey);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.75rem;
  color: var(--color-text);
  text-align: center;
}

.board-title {
  font-size: 1.1rem;
  text-align: center;
  color: #fff8ea;
}

.notes-area {
  position: relative;
  flex: 1;
  min-height: 340px;
}

.empty-day {
  color: rgba(255, 248, 234, 0.7);
  font-size: 0.8rem;
  text-align: center;
}

.pinned-note-wrap {
  position: absolute;
  width: 100px;
  height: 100px;
}

/* Post-its can overlap once dragged around. Lift the one under the pointer
   above its neighbours, so its ✕ is never hidden under another post-it. */
.pinned-note-wrap:hover,
.pinned-note-wrap:focus-within {
  z-index: 5;
}

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

.pinned-note:active {
  cursor: grabbing;
}

/* Past post-its are grayed out (see --color-note-past); the pin fades with
   them, but a "Good job" stamp keeps its colour so finished days still pop. */
.pinned-note-past .pin {
  filter: grayscale(1);
  opacity: 0.6;
}

.pinned-note-past .pinned-note-title,
.pinned-note-past .pinned-note-task-count {
  color: var(--color-text-muted);
}

.pinned-note-today {
  width: 100px;
  height: 100px;
}

.pin {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
}

.pinned-note-title {
  font-size: 0.8rem;
  font-family: var(--font-heading);
  color: var(--color-text);
  word-break: break-word;
}

.pinned-note-task-count {
  font-size: 0.65rem;
  color: var(--color-text-muted);
}

.mini-stamp {
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 28px;
  transform: rotate(-10deg);
  pointer-events: none;
}

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

.pinned-note-wrap:hover .delete-note-button,
.delete-note-button:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

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

.delete-confirm-title {
  color: var(--color-text);
  font-family: var(--font-heading);
  font-size: 0.95rem;
}

.delete-confirm-detail {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.delete-confirm-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 6px;
}

.delete-confirm-yes,
.delete-confirm-no {
  padding: 8px 14px;
  border-radius: 8px;
  border: var(--outline-width) solid var(--color-ink);
  cursor: pointer;
  font-family: var(--font-heading);
}

.delete-confirm-yes {
  background: #e76f51;
  color: #fff8ea;
}

.delete-confirm-no {
  background: transparent;
  color: var(--color-text);
}

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

.add-note-title-input {
  font: inherit;
  font-size: 0.85rem;
  padding: 6px 8px;
  border-radius: 6px;
  border: var(--outline-width) solid var(--color-ink);
  color: var(--color-text);
}

.add-note-colors {
  display: flex;
  gap: 6px;
}

.add-note-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: var(--outline-width) solid var(--color-ink);
  cursor: pointer;
  padding: 0;
}

.add-note-swatch.selected {
  outline: 2px solid var(--color-text);
  outline-offset: 2px;
}

.add-note-buttons {
  display: flex;
  gap: 8px;
}

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

.add-note-confirm {
  background: var(--color-check-green);
  color: #fff8ea;
}

.add-note-cancel {
  background: transparent;
  color: var(--color-text);
}

.desk {
  position: relative;
  flex: 0 0 220px;
  overflow: hidden;
}

.bee-at-desk {
  position: absolute;
  right: 24px;
  bottom: 12px;
}
</style>
