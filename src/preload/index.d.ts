// No working code here. This just lists what window.api offers, so the
// code editor can suggest names and catch typos. If you add something to
// preload/index.ts, add it here too.
import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  Note,
  BoardNote,
  Task,
  NewTask,
  TaskStatus,
  VaultStatus,
  DayResult
} from '../shared/types'

// Everything a screen can ask for through window.api.
interface TodobeeApi {
  /** All the tasks on one post-it. */
  listTasks: (noteId: number) => Promise<Task[]>
  /** Adds a task to a post-it. */
  createTask: (noteId: number, input: NewTask) => Promise<Task>
  /** Renames a task. */
  updateTaskTitle: (taskId: number, title: string) => Promise<Task>
  /** Ticks ("done") or un-ticks ("open") a task. */
  setTaskStatus: (taskId: number, status: TaskStatus) => Promise<Task>
  /** Deletes a task. */
  deleteTask: (taskId: number) => Promise<void>
  /** Loads every post-it for a day (0 = today, -1 = yesterday, 1 = tomorrow). */
  getDayForOffset: (dayOffset: number) => Promise<DayResult>
  /** Loads one post-it, or nothing (null) if it doesn't exist. */
  getNoteById: (noteId: number) => Promise<Note | null>
  /** Moves a finished task from an old post-it back to today, as not done. */
  moveTaskToToday: (taskId: number) => Promise<Task>
  /** Saves where a post-it was dragged on the board. */
  setNotePosition: (noteId: number, x: number, y: number) => Promise<void>
  /** Makes a new post-it on a day. */
  createNote: (title: string, colour: string, dayOffset: number) => Promise<BoardNote>
  /** Renames a post-it. */
  renameNote: (noteId: number, title: string) => Promise<Note>
  /** Deletes a post-it and all its tasks. */
  deleteNote: (noteId: number) => Promise<void>
  /** Moves the post-it's unfinished tasks to tomorrow, and says how many moved. */
  moveOpenTasksToNextDay: (noteId: number) => Promise<number>
  /** Which Obsidian folder is saved, and can it still be found? */
  getVaultStatus: () => Promise<VaultStatus>
  /** Opens the folder picker. Gives back nothing (null) if you press Cancel. */
  chooseVaultFolder: () => Promise<VaultStatus | null>
}

// Tells the code editor that window.electron and window.api exist on
// every screen.
declare global {
  interface Window {
    electron: ElectronAPI
    api: TodobeeApi
  }
}
