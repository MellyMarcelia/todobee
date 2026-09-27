import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  getOrCreateTodayNote,
  listTasksForNote,
  createTask,
  updateTaskTitle,
  setTaskStatus,
  deleteTask
} from './tasksRepo'
import type { NewTask } from '../shared/types'

/** Today's date as "YYYY-MM-DD" in the user's local timezone. */
function todayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 440,
    height: 680,
    minWidth: 380,
    minHeight: 580,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#FDF3DC',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.todobee.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong')) // demo IPC handshake — remove once real IPC channels exist

  // Today's note + task CRUD (Milestone 2). Each handler is a thin wrapper
  // around tasksRepo — the actual SQL lives there, this just wires it to IPC.
  ipcMain.handle('todayNote:get', () => getOrCreateTodayNote(todayDateString()))
  ipcMain.handle('tasks:list', (_event, noteId: number) => listTasksForNote(noteId))
  ipcMain.handle('tasks:create', (_event, noteId: number, input: NewTask) =>
    createTask(noteId, input)
  )
  ipcMain.handle('tasks:updateTitle', (_event, taskId: number, title: string) =>
    updateTaskTitle(taskId, title)
  )
  ipcMain.handle('tasks:setStatus', (_event, taskId: number, status: 'open' | 'done') =>
    setTaskStatus(taskId, status)
  )
  ipcMain.handle('tasks:delete', (_event, taskId: number) => deleteTask(taskId))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
