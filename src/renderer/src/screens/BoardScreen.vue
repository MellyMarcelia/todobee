<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import Bee from '../components/Bee.vue'
import PinIcon from '../components/icons/PinIcon.vue'
import GearIcon from '../components/icons/GearIcon.vue'
import goodJobStamp from '../assets/stamps/good-job-stamp.png'
import type { VaultStatus, DayResult, BoardNote } from '../../../shared/types'

const emit = defineEmits<{ open: [noteId: number]; 'open-settings': [] }>()

// Milestone 7 (revised): history board, one day at a time. dayOffset 0 is
// today, negative is further into the past — the main process does all the
// date math (see notes:getForDay in main/index.ts) and also caps forward
// paging at today, so the renderer never has to reason about "the future".
// Milestone 8b: a day can have several post-its now (day.notes is a list),
// each with its own task count for the "N tasks" label.
const dayOffset = ref(0)
const day = ref<DayResult | null>(null)
const loadError = ref<string | null>(null)

async function loadDay(): Promise<void> {
  loadError.value = null
  try {
    day.value = await window.api.getDayForOffset(dayOffset.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to load day:', error)
  }
}

onMounted(loadDay)
watch(dayOffset, loadDay)

function previousDay(): void {
  dayOffset.value -= 1
}

function nextDay(): void {
  if (day.value?.canGoForward) dayOffset.value += 1
}

// Milestone 7 follow-up: dragging a note around the board. It gets an
// absolute pixel position within `.notes-area` — either a saved
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
// Live position shown while dragging/after a drag, keyed by note id — kept
// separate from the note's own boardX/boardY so we don't have to mutate the
// props-like `note` object directly.
const livePositions = ref<Record<number, { x: number; y: number }>>({})

// Milestone 8b: several post-its can be on the board at once, so their
// default (never-dragged) positions are staggered instead of stacking on
// top of each other — a simple diagonal cascade, offset by the note's
// position in the day's list.
function defaultPosition(index: number): { x: number; y: number } {
  return { x: 20 + index * 34, y: 20 + index * 34 }
}

function positionFor(note: BoardNote, index: number): { x: number; y: number } {
  const live = livePositions.value[note.id]
  if (live) return live
  if (note.boardX !== null && note.boardY !== null) return { x: note.boardX, y: note.boardY }
  return defaultPosition(index)
}

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

async function endDrag(event: PointerEvent, note: BoardNote, index: number): Promise<void> {
  const drag = dragState.value
  if (!drag || event.pointerId !== drag.pointerId) return
  dragState.value = null

  if (!drag.moved) {
    // A click, not a drag — open the note as usual.
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
// works normally either way — this is just a nudge to visit Settings.
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

// Milestone 8b: "+ new post-it". Only available on today (you can't add a
// post-it to a sealed, read-only past day). Picking a colour + typing a
// title creates the note, then the day is reloaded so it shows up pinned.
const NEW_NOTE_COLORS = ['#F6C56A', '#E76F51', '#4A90D9', '#E9A23B', '#7FB069']
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

async function confirmAddNote(): Promise<void> {
  const title = newNoteTitle.value.trim()
  if (!title) return
  try {
    await window.api.createNote(title, newNoteColour.value)
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
        <h2 class="board-title">to-do</h2>
        <button class="settings-button" aria-label="Settings" @click="$emit('open-settings')">
          <GearIcon />
        </button>
      </div>

      <div class="day-nav">
        <button class="day-arrow" aria-label="Previous day" @click="previousDay">‹</button>
        <span class="day-label">{{ day?.dateLabel ?? '…' }}</span>
        <button
          class="day-arrow"
          aria-label="Next day"
          :disabled="!day?.canGoForward"
          @click="nextDay"
        >
          ›
        </button>
      </div>

      <p v-if="vaultStatus && !vaultStatus.path" class="warning-banner">
        Choose your Obsidian vault in Settings so your tasks get logged
      </p>
      <p v-else-if="vaultStatus && !vaultStatus.exists" class="warning-banner">
        Your vault folder can't be found, choose it again
      </p>
      <p v-if="loadError" class="warning-banner">Couldn't load this day: {{ loadError }}</p>

      <div ref="notesAreaRef" class="notes-area">
        <button
          v-for="(note, index) in day?.notes ?? []"
          :key="note.id"
          class="pinned-note"
          :class="{ 'pinned-note-today': day?.isToday }"
          :style="{
            background: note.colour,
            left: `${positionFor(note, index).x}px`,
            top: `${positionFor(note, index).y}px`
          }"
          @pointerdown="startDrag($event, note, index)"
          @pointermove="onDragMove"
          @pointerup="endDrag($event, note, index)"
        >
          <span class="pin"><PinIcon :color="note.colour" /></span>
          <span v-if="day?.isToday" class="today-label">today</span>
          <img v-if="note.perfectDay" :src="goodJobStamp" alt="Good job" class="mini-stamp" />
          <span class="pinned-note-title">{{ note.title }}</span>
          <span class="pinned-note-task-count">{{ note.taskCount }} task{{ note.taskCount === 1 ? '' : 's' }}</span>
        </button>

        <p v-if="day && day.notes.length === 0" class="empty-day">Nothing here yet</p>

        <!-- Milestone 8b: "+ new post-it" — only on today, since past days
             are read-only history. -->
        <button v-if="day?.isToday && !isAddingNote" class="add-note-button" @click="startAddingNote">
          + new post-it
        </button>

        <div v-if="isAddingNote" class="add-note-form">
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

.pinned-note {
  position: absolute;
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

.pinned-note-today {
  width: 100px;
  height: 100px;
}

.today-label {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.65rem;
  font-family: var(--font-heading);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
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

.add-note-button {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 0.75rem;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px dashed rgba(255, 248, 234, 0.7);
  background: transparent;
  color: #fff8ea;
  cursor: pointer;
}

.add-note-form {
  position: absolute;
  bottom: 8px;
  left: 8px;
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
