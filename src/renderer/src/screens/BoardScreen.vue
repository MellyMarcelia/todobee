<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import Bee from '../components/Bee.vue'
import PinIcon from '../components/icons/PinIcon.vue'
import GearIcon from '../components/icons/GearIcon.vue'
import goodJobStamp from '../assets/stamps/good-job-stamp.png'
import type { VaultStatus, DayResult, Note } from '../../../shared/types'

const emit = defineEmits<{ open: [noteDate: string]; 'open-settings': [] }>()

// Milestone 7 (revised): history board, one day at a time. dayOffset 0 is
// today, negative is further into the past — the main process does all the
// date math (see notes:getForDay in main/index.ts) and also caps forward
// paging at today, so the renderer never has to reason about "the future".
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

// A little pin color per note, purely cosmetic — cycles through a small
// fixed set so the board doesn't look monotone across days.
const pinColors = ['#E76F51', '#4A90D9', '#E9A23B', '#7FB069']

function pinColorFor(index: number): string {
  return pinColors[index % pinColors.length]
}

// Milestone 7 follow-up: dragging the note around the board. It gets an
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

function defaultPosition(): { x: number; y: number } {
  return { x: 130, y: 40 }
}

function positionFor(note: Note): { x: number; y: number } {
  const live = livePositions.value[note.id]
  if (live) return live
  if (note.boardX !== null && note.boardY !== null) return { x: note.boardX, y: note.boardY }
  return defaultPosition()
}

function startDrag(event: PointerEvent, note: Note): void {
  const current = positionFor(note)
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

async function endDrag(event: PointerEvent, note: Note): Promise<void> {
  const drag = dragState.value
  if (!drag || event.pointerId !== drag.pointerId) return
  dragState.value = null

  if (!drag.moved) {
    // A click, not a drag — open the note as usual.
    emit('open', note.noteDate)
    return
  }

  const final = positionFor(note)
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
          v-if="day?.note"
          class="pinned-note pinned-note-today"
          :style="{
            background: day.isToday ? '#F6C56A' : '#9FD8A3',
            left: `${positionFor(day.note).x}px`,
            top: `${positionFor(day.note).y}px`
          }"
          @pointerdown="startDrag($event, day.note)"
          @pointermove="onDragMove"
          @pointerup="endDrag($event, day.note)"
        >
          <span class="pin"><PinIcon :color="pinColorFor(0)" /></span>
          <span v-if="day.isToday" class="today-label">today</span>
          <img v-if="day.note.perfectDay" :src="goodJobStamp" alt="Good job" class="mini-stamp" />
          <span class="pinned-note-lines">
            <span class="line" />
            <span class="line short" />
          </span>
        </button>

        <p v-else-if="day" class="empty-day">Nothing here yet</p>
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
  width: 88px;
  height: 88px;
  border: var(--outline-width) solid var(--color-ink);
  border-radius: 8px;
  cursor: grab;
  padding: 18px 10px 10px;
  font: inherit;
  touch-action: none;
}

.pinned-note:active {
  cursor: grabbing;
}

.pinned-note-today {
  width: 120px;
  height: 120px;
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

.mini-stamp {
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 28px;
  transform: rotate(-10deg);
  pointer-events: none;
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
