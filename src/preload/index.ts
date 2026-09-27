import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Note, BoardNote, Task, NewTask, DayResult, VaultStatus } from '../shared/types'

// Custom APIs for renderer
const api = {
  // Task CRUD (Milestone 2/4/6/8b — see main/index.ts for what each call does).
  listTasks: (noteId: number): Promise<Task[]> => ipcRenderer.invoke('tasks:list', noteId),
  createTask: (noteId: number, input: NewTask): Promise<Task> =>
    ipcRenderer.invoke('tasks:create', noteId, input),
  updateTaskTitle: (taskId: number, title: string): Promise<Task> =>
    ipcRenderer.invoke('tasks:updateTitle', taskId, title),
  setTaskStatus: (taskId: number, status: 'open' | 'done'): Promise<Task> =>
    ipcRenderer.invoke('tasks:setStatus', taskId, status),
  deleteTask: (taskId: number): Promise<void> => ipcRenderer.invoke('tasks:delete', taskId),
  moveTaskToToday: (taskId: number): Promise<Task> =>
    ipcRenderer.invoke('tasks:moveToToday', taskId),

  // History board (Milestone 7, revised) + multiple post-its per day (Milestone 8b).
  getDayForOffset: (dayOffset: number): Promise<DayResult> =>
    ipcRenderer.invoke('notes:getForDay', dayOffset),
  getNoteById: (noteId: number): Promise<Note | null> => ipcRenderer.invoke('notes:getById', noteId),
  setNotePosition: (noteId: number, x: number, y: number): Promise<void> =>
    ipcRenderer.invoke('notes:setPosition', noteId, x, y),
  createNote: (title: string, colour: string): Promise<BoardNote> =>
    ipcRenderer.invoke('notes:create', title, colour),
  renameNote: (noteId: number, title: string): Promise<Note> =>
    ipcRenderer.invoke('notes:rename', noteId, title),

  // Settings / Obsidian vault folder (Milestone 5).
  getVaultStatus: (): Promise<VaultStatus> => ipcRenderer.invoke('vault:getStatus'),
  chooseVaultFolder: (): Promise<VaultStatus | null> => ipcRenderer.invoke('vault:chooseFolder'),

  // Dev-only: only exists while running `npm run dev`, see main/index.ts.
  ...(process.env['ELECTRON_RENDERER_URL']
    ? { simulateNextDay: (): Promise<void> => ipcRenderer.invoke('dev:simulateNextDay') }
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
