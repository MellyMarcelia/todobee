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

interface TodobeeApi {
  listTasks: (noteId: number) => Promise<Task[]>
  createTask: (noteId: number, input: NewTask) => Promise<Task>
  updateTaskTitle: (taskId: number, title: string) => Promise<Task>
  setTaskStatus: (taskId: number, status: TaskStatus) => Promise<Task>
  deleteTask: (taskId: number) => Promise<void>
  getDayForOffset: (dayOffset: number) => Promise<DayResult>
  getNoteById: (noteId: number) => Promise<Note | null>
  moveTaskToToday: (taskId: number) => Promise<Task>
  setNotePosition: (noteId: number, x: number, y: number) => Promise<void>
  createNote: (title: string, colour: string) => Promise<BoardNote>
  renameNote: (noteId: number, title: string) => Promise<Note>
  deleteNote: (noteId: number) => Promise<void>
  /** Moves the post-it's unfinished tasks to tomorrow; resolves to how many moved. */
  moveOpenTasksToNextDay: (noteId: number) => Promise<number>
  getVaultStatus: () => Promise<VaultStatus>
  chooseVaultFolder: () => Promise<VaultStatus | null>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: TodobeeApi
  }
}
