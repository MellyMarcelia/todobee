import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Note, Task, NewTask, TaskStatus, VaultStatus, DayResult } from '../shared/types'

// Custom API for the renderer — today's note + task CRUD (Milestone 2),
// extended with launch rollover (Milestone 4). Each function just forwards
// to an ipcMain.handle in src/main/index.ts and returns its result; the
// renderer never touches SQLite or Node directly.
//
// Dev detection here can't use @electron-toolkit/utils's `is.dev` — that
// reads Electron's `app` module, which only exists in the main process.
// Importing it from a preload script throws at load time (app is undefined
// here), which silently crashes the whole preload script before
// contextBridge ever runs — leaving window.api completely undefined in the
// renderer. ELECTRON_RENDERER_URL is only set by electron-vite in `npm run
// dev`, so it's a safe dev/packaged signal from inside preload.
const isDev = Boolean(process.env['ELECTRON_RENDERER_URL'])

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
  // Milestone 7 (revised): history board, one day at a time.
  getDayForOffset: (dayOffset: number): Promise<DayResult> =>
    ipcRenderer.invoke('notes:getForDay', dayOffset),
  getNoteByDate: (noteDate: string): Promise<Note | null> =>
    ipcRenderer.invoke('notes:getByDate', noteDate),
  moveTaskToToday: (taskId: number): Promise<Task> =>
    ipcRenderer.invoke('tasks:moveToToday', taskId),
  setNotePosition: (noteId: number, x: number, y: number): Promise<void> =>
    ipcRenderer.invoke('notes:setPosition', noteId, x, y),
  // Milestone 5: Settings + vault folder picker.
  getVaultStatus: (): Promise<VaultStatus> => ipcRenderer.invoke('vault:getStatus'),
  chooseVaultFolder: (): Promise<VaultStatus | null> =>
    ipcRenderer.invoke('vault:chooseFolder'),
  // Dev-only: advances the app's simulated "today" by one day and re-runs
  // rollover, so rollover can be tested without waiting for a real day to
  // pass. Only exposed in `npm run dev` — never present in a packaged build.
  ...(isDev
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
