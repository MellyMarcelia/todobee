import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getDb } from './db'
import { runLaunchRollover } from './rollover'
import { getVaultStatus, setVaultPath } from './settingsRepo'
import { appendTaskEvent } from './obsidianLogger'
import { getNoteByDate, setNotePosition } from './notesRepo'
import { recalculatePerfectDay } from './perfectDay'
import { parseDateString, addDays, formatDateString, formatLongDate } from './dateUtils'
import {
  listTasksForNote,
  getTaskById,
  createTask,
  updateTaskTitle,
  setTaskStatus,
  deleteTask,
  moveTaskToNote
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

// Dev-only "simulate next day" helper (Milestone 4). Lets you test rollover
// without waiting for the system clock to roll over. Only exists while
// `is.dev` is true — never present in a packaged build.
let devDateOffsetDays = 0

function currentAppDateString(): string {
  if (devDateOffsetDays === 0) return todayDateString()
  const shifted = new Date()
  shifted.setDate(shifted.getDate() + devDateOffsetDays)
  const year = shifted.getFullYear()
  const month = String(shifted.getMonth() + 1).padStart(2, '0')
  const day = String(shifted.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Runs rollover for the given date and logs one task.edited "moved from"
 * line per task that got carried over — shared by the real launch handler
 * and the dev-only "simulate next day" handler so they can't drift apart.
 */
function rolloverAndLog(dateString: string): ReturnType<typeof runLaunchRollover> {
  const result = runLaunchRollover(getDb(), dateString)
  const vaultPath = getVaultStatus(getDb()).path
  for (const moved of result.movedTasks) {
    appendTaskEvent(vaultPath, {
      type: 'task.edited',
      status: 'open',
      title: moved.title,
      movedFrom: moved.fromDate
    })
  }
  return result
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

  // Today's note + task CRUD (Milestone 2, extended with rollover in
  // Milestone 4). Each handler is a thin wrapper around tasksRepo/rollover —
  // the actual SQL lives there, this just wires it to IPC. Milestone 6 adds
  // one appendTaskEvent call per event, right after the SQL succeeds, using
  // the current saved vault path — logging failures never throw (see
  // obsidianLogger.ts), so a bad/missing vault can't break task management.
  ipcMain.handle('todayNote:get', () => rolloverAndLog(currentAppDateString()))
  ipcMain.handle('tasks:list', (_event, noteId: number) => listTasksForNote(noteId))
  ipcMain.handle('tasks:create', (_event, noteId: number, input: NewTask) => {
    const created = createTask(noteId, input)
    recalculatePerfectDay(getDb(), noteId)
    appendTaskEvent(getVaultStatus(getDb()).path, {
      type: 'task.created',
      status: created.status,
      title: created.title
    })
    return created
  })
  ipcMain.handle('tasks:updateTitle', (_event, taskId: number, title: string) => {
    const updated = updateTaskTitle(taskId, title)
    appendTaskEvent(getVaultStatus(getDb()).path, {
      type: 'task.edited',
      status: updated.status,
      title: updated.title
    })
    return updated
  })
  ipcMain.handle('tasks:setStatus', (_event, taskId: number, status: 'open' | 'done') => {
    const updated = setTaskStatus(taskId, status)
    recalculatePerfectDay(getDb(), updated.noteId)
    appendTaskEvent(getVaultStatus(getDb()).path, {
      type: status === 'done' ? 'task.completed' : 'task.reopened',
      status: updated.status,
      title: updated.title
    })
    return updated
  })
  ipcMain.handle('tasks:delete', (_event, taskId: number) => {
    const task = getTaskById(taskId)
    deleteTask(taskId)
    if (task) {
      recalculatePerfectDay(getDb(), task.noteId)
      appendTaskEvent(getVaultStatus(getDb()).path, {
        type: 'task.deleted',
        status: task.status,
        title: task.title
      })
    }
  })

  // Milestone 7 (revised): history board, one day at a time. dayOffset 0 is
  // today, -1 is yesterday, etc. — browsing is capped at today (canGoForward
  // is false once dayOffset reaches 0) since there's never a future note to
  // look at. note is null for a day that has no note yet (no tasks were ever
  // created/rolled onto it).
  ipcMain.handle('notes:getForDay', (_event, dayOffset: number) => {
    const clampedOffset = Math.min(dayOffset, 0)
    const today = parseDateString(currentAppDateString())
    const date = addDays(today, clampedOffset)
    const dateString = formatDateString(date)
    const note = getNoteByDate(getDb(), dateString)
    return {
      note,
      dateLabel: formatLongDate(date),
      dayOffset: clampedOffset,
      isToday: clampedOffset === 0,
      canGoForward: clampedOffset < 0
    }
  })
  ipcMain.handle('notes:getByDate', (_event, noteDate: string) => getNoteByDate(getDb(), noteDate))
  ipcMain.handle('notes:setPosition', (_event, noteId: number, x: number, y: number) =>
    setNotePosition(getDb(), noteId, x, y)
  )

  // Reopening a done task on a past (read-only) note, after the user
  // confirms "move this task to today?". Moves the task onto today's note,
  // reopens it, and logs a task.reopened line — same event type as
  // reopening a task in place, since from the log's point of view the task
  // just became open again (its new note is implied by today's date).
  ipcMain.handle('tasks:moveToToday', (_event, taskId: number) => {
    const sourceTask = getTaskById(taskId)
    const today = rolloverAndLog(currentAppDateString())
    const moved = moveTaskToNote(taskId, today.id)
    if (sourceTask) recalculatePerfectDay(getDb(), sourceTask.noteId)
    recalculatePerfectDay(getDb(), today.id)
    appendTaskEvent(getVaultStatus(getDb()).path, {
      type: 'task.reopened',
      status: moved.status,
      title: moved.title
    })
    return moved
  })

  // Milestone 5: Settings + vault folder picker. getStatus returns both the
  // saved path and whether it currently exists on disk (the folder could
  // have been moved/deleted since it was chosen) so the renderer can pick
  // the right warning banner. chooseFolder opens the native macOS folder
  // picker and saves the result; it resolves to null if the user cancels.
  ipcMain.handle('vault:getStatus', () => getVaultStatus(getDb()))
  ipcMain.handle('vault:chooseFolder', async () => {
    const mainWindow = BrowserWindow.getFocusedWindow()
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    const chosenPath = result.filePaths[0]
    setVaultPath(getDb(), chosenPath)
    return getVaultStatus(getDb())
  })

  // Dev-only: lets the renderer's "simulate next day" button advance the
  // app's notion of "today" by one day and immediately re-run rollover, so
  // rollover can be tested without waiting for the real clock to turn over.
  if (is.dev) {
    ipcMain.handle('dev:simulateNextDay', () => {
      devDateOffsetDays += 1
      return rolloverAndLog(currentAppDateString())
    })
  }

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
