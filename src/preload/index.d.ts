import { ElectronAPI } from '@electron-toolkit/preload'
import type { Note, Task, NewTask, TaskStatus } from '../shared/types'

interface TodobeeApi {
  getTodayNote: () => Promise<Note>
  listTasks: (noteId: number) => Promise<Task[]>
  createTask: (noteId: number, input: NewTask) => Promise<Task>
  updateTaskTitle: (taskId: number, title: string) => Promise<Task>
  setTaskStatus: (taskId: number, status: TaskStatus) => Promise<Task>
  deleteTask: (taskId: number) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: TodobeeApi
  }
}
