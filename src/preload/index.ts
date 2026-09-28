// The messenger between the screens and the behind-the-scenes part of the
// app. For safety, screens can't touch your files or the database
// directly. Instead they call window.api.something(), and this file passes
// the request along to main/index.ts and brings the answer back.
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Note, BoardNote, Task, NewTask, DayResult, VaultStatus } from '../shared/types'

// Every request a screen is allowed to make.
const api = {
  // Tasks: list, add, rename, tick, delete, move to today.
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

  // Post-its: load a day, add, rename, drag, delete, push leftovers to tomorrow.
  getDayForOffset: (dayOffset: number): Promise<DayResult> =>
    ipcRenderer.invoke('notes:getForDay', dayOffset),
  getNoteById: (noteId: number): Promise<Note | null> =>
    ipcRenderer.invoke('notes:getById', noteId),
  setNotePosition: (noteId: number, x: number, y: number): Promise<void> =>
    ipcRenderer.invoke('notes:setPosition', noteId, x, y),
  createNote: (title: string, colour: string, dayOffset: number): Promise<BoardNote> =>
    ipcRenderer.invoke('notes:create', title, colour, dayOffset),
  renameNote: (noteId: number, title: string): Promise<Note> =>
    ipcRenderer.invoke('notes:rename', noteId, title),
  deleteNote: (noteId: number): Promise<void> => ipcRenderer.invoke('notes:delete', noteId),
  moveOpenTasksToNextDay: (noteId: number): Promise<number> =>
    ipcRenderer.invoke('notes:moveOpenTasksToNextDay', noteId),

  // Settings: which Obsidian vault folder to write the log into.
  getVaultStatus: (): Promise<VaultStatus> => ipcRenderer.invoke('vault:getStatus'),
  chooseVaultFolder: (): Promise<VaultStatus | null> => ipcRenderer.invoke('vault:chooseFolder')
}

// Hand the list above to the screens as window.api.
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
