import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { is } from '@electron-toolkit/utils'
import type { Note, Task, NewTask, TaskStatus } from '../shared/types'

// Custom API for the renderer — today's note + task CRUD (Milestone 2),
// extended with launch rollover (Milestone 4). Each function just forwards
// to an ipcMain.handle in src/main/index.ts and returns its result; the
// renderer never touches SQLite or Node directly.
const api = {
  getTodayNote: (): Promise<Note> => ipcRenderer.invoke('todayNote:get'),
  listTasks: (noteId: number): Promise<Task[]> => ipcRenderer.invoke('tasks:list', noteId),
  createTask: (noteId: number, input: NewTask): Promise<Task> =>
    ipcRenderer.invoke('tasks:create', noteId, input),
  updateTaskTitle: (taskId: number, title: string): Promise<Task> =>
    ipcRenderer.invoke('tasks:updateTitle', taskId, title),
  setTaskStatus: (taskId: number, status: TaskStatus): Promise<Task> =>
    ipcRenderer.invoke('tasks:setStatus', taskId, status),
  deleteTask: (taskId: number): Promise<void> => ipcRenderer.invoke('tasks:delete', taskId),
  // Dev-only: advances the app's simulated "today" by one day and re-runs
  // rollover, so rollover can be tested without waiting for a real day to
  // pass. Only exposed in `npm run dev` — never present in a packaged build.
  ...(is.dev
    ? { simulateNextDay: (): Promise<Note> => ipcRenderer.invoke('dev:simulateNextDay') }
    : {})
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
