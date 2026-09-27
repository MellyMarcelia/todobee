import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getDb } from './db'
import { runLaunchRollover } from './rollover'
import { getVaultStatus, setVaultPath, getDevDateOffset, setDevDateOffset } from './settingsRepo'
import { appendTaskEvent } from './obsidianLogger'
import type { TaskEvent } from './obsidianLogger'
import {
  listNotesForDate,
  getNoteById,
  createNote,
  updateNoteTitle,
  setNotePosition,
  deleteNote
} from './notesRepo'
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
import { DEFAULT_NOTE_TITLE, DEFAULT_NOTE_COLOUR } from '../shared/types'

/** Today's date as "YYYY-MM-DD" in the user's local timezone. */
function todayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Dev-only "simulate next day" helper (Milestone 4). Lets you test rollover
// without waiting for the system clock to roll over. Only used while
// `is.dev` is true — never present in a packaged build. The offset is saved
// in the settings table so it survives restarts: when it lived only in
// memory, restarting jumped the app back to the real date and stranded any
// tasks already moved onto the simulated days.
let devDateOffsetDays = 0

/** "Now" as the app sees it: the real clock, shifted by the dev offset (always 0 in production). */
function currentAppDate(): Date {
  const shifted = new Date()
  shifted.setDate(shifted.getDate() + devDateOffsetDays)
  return shifted
}

function currentAppDateString(): string {
  if (devDateOffsetDays === 0) return todayDateString()
  const shifted = currentAppDate()
  const year = shifted.getFullYear()
  const month = String(shifted.getMonth() + 1).padStart(2, '0')
  const day = String(shifted.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Appends one task event to the vault log, in the log file for the app's
 * current day — so with the dev offset active, events land in the simulated
 * day's file rather than the real date's.
 */
function logTaskEvent(event: TaskEvent): void {
  appendTaskEvent(getVaultStatus(getDb()).path, event, currentAppDate())
}

/**
 * Runs rollover for the given date and logs one task.edited "moved from"
 * line per task that got carried over — shared by the real launch handler
 * and the dev-only "simulate next day" handler so they can't drift apart.
 */
function rolloverAndLog(dateString: string): ReturnType<typeof runLaunchRollover> {
  const result = runLaunchRollover(getDb(), dateString)
  for (const moved of result.movedTasks) {
    logTaskEvent({
      type: 'task.edited',
      status: 'open',
      title: moved.title,
      noteTitle: moved.noteTitle,
      movedFrom: moved.fromDate
    })
  }
  return result
}

/**
 * Finds today's post-it with the given title+colour, or creates one if none
 * matches yet. Used both by "move this task to today" (find/create a
 * post-it matching the task's original note) and could be reused anywhere
 * else that needs "the post-it that continues this one, today".
 */
function ensureTodayNoteFor(title: string, colour: string): ReturnType<typeof createNote> {
  const db = getDb()
  const todayDate = currentAppDateString()
  const existing = listNotesForDate(db, todayDate).find(
    (note) => note.title === title && note.colour === colour
  )
  if (existing) return existing
  return createNote(db, todayDate, title, colour)
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

  // Task CRUD (Milestone 2, extended with rollover in Milestone 4). Each
  // handler is a thin wrapper around tasksRepo/notesRepo — the actual SQL
  // lives there, this just wires it to IPC + logging. Milestone 6 adds one
  // appendTaskEvent call per event, right after the SQL succeeds, using the
  // current saved vault path — logging failures never throw (see
  // obsidianLogger.ts), so a bad/missing vault can't break task management.
  // Milestone 8b: every log line also needs the post-it's title, so each
  // handler looks up the owning note first.
  ipcMain.handle('tasks:list', (_event, noteId: number) => listTasksForNote(noteId))
  ipcMain.handle('tasks:create', (_event, noteId: number, input: NewTask) => {
    const created = createTask(noteId, input)
    recalculatePerfectDay(getDb(), noteId)
    const note = getNoteById(getDb(), noteId)
    logTaskEvent({
      type: 'task.created',
      status: created.status,
      title: created.title,
      noteTitle: note?.title ?? DEFAULT_NOTE_TITLE
    })
    return created
  })
  ipcMain.handle('tasks:updateTitle', (_event, taskId: number, title: string) => {
    const updated = updateTaskTitle(taskId, title)
    const note = getNoteById(getDb(), updated.noteId)
    logTaskEvent({
      type: 'task.edited',
      status: updated.status,
      title: updated.title,
      noteTitle: note?.title ?? DEFAULT_NOTE_TITLE
    })
    return updated
  })
  ipcMain.handle('tasks:setStatus', (_event, taskId: number, status: 'open' | 'done') => {
    const updated = setTaskStatus(taskId, status)
    recalculatePerfectDay(getDb(), updated.noteId)
    const note = getNoteById(getDb(), updated.noteId)
    logTaskEvent({
      type: status === 'done' ? 'task.completed' : 'task.reopened',
      status: updated.status,
      title: updated.title,
      noteTitle: note?.title ?? DEFAULT_NOTE_TITLE
    })
    return updated
  })
  ipcMain.handle('tasks:delete', (_event, taskId: number) => {
    const task = getTaskById(taskId)
    deleteTask(taskId)
    if (task) {
      recalculatePerfectDay(getDb(), task.noteId)
      const note = getNoteById(getDb(), task.noteId)
      logTaskEvent({
        type: 'task.deleted',
        status: task.status,
        title: task.title,
        noteTitle: note?.title ?? DEFAULT_NOTE_TITLE
      })
    }
  })

  // Milestone 7 (revised) + 8b: history board, one day at a time, showing
  // every post-it on that day. dayOffset 0 is today, -1 is yesterday, etc.
  // — browsing is capped at today (canGoForward is false once dayOffset
  // reaches 0) since there's never a future day to look at. Loading today
  // (dayOffset 0) runs rollover first so the default post-it and any
  // carried-over post-its exist before we list them; past days are pure
  // reads since a sealed day's post-its never change.
  ipcMain.handle('notes:getForDay', (_event, dayOffset: number) => {
    const clampedOffset = Math.min(dayOffset, 0)
    const today = parseDateString(currentAppDateString())
    const date = addDays(today, clampedOffset)
    const dateString = formatDateString(date)
    if (clampedOffset === 0) rolloverAndLog(dateString)
    const notes = listNotesForDate(getDb(), dateString)
    return {
      notes,
      dateLabel: formatLongDate(date),
      dayOffset: clampedOffset,
      isToday: clampedOffset === 0,
      canGoForward: clampedOffset < 0
    }
  })
  ipcMain.handle('notes:getById', (_event, noteId: number) => getNoteById(getDb(), noteId))
  ipcMain.handle('notes:setPosition', (_event, noteId: number, x: number, y: number) =>
    setNotePosition(getDb(), noteId, x, y)
  )

  // Milestone 8b: "+ new post-it" on the board. Always created on today
  // (you can only add post-its to the day you're actively working in).
  ipcMain.handle('notes:create', (_event, title: string, colour: string) =>
    createNote(getDb(), currentAppDateString(), title, colour)
  )
  ipcMain.handle('notes:rename', (_event, noteId: number, title: string) =>
    updateNoteTitle(getDb(), noteId, title)
  )
  // Deleting a whole post-it (the ✕ on today's board). Sealed history can't
  // be deleted — same rule as tasks on a past post-it. Every task on it is
  // logged as task.deleted, so removing a post-it never silently drops tasks
  // from the vault log.
  ipcMain.handle('notes:delete', (_event, noteId: number) => {
    const note = getNoteById(getDb(), noteId)
    if (!note) return
    if (note.sealed) throw new Error(`"${note.title}" is read-only history and can't be deleted.`)
    const deletedTasks = deleteNote(getDb(), noteId)
    for (const task of deletedTasks) {
      logTaskEvent({
        type: 'task.deleted',
        status: task.status,
        title: task.title,
        noteTitle: note.title
      })
    }
  })

  // Reopening a done task on a past (read-only) note, after the user
  // confirms "move this task to today?". Finds (or creates) the post-it on
  // today with the same title+colour as the task's original note — the
  // same rule rollover itself uses — moves the task there, reopens it, and
  // logs a task.reopened line.
  ipcMain.handle('tasks:moveToToday', (_event, taskId: number) => {
    const sourceTask = getTaskById(taskId)
    const sourceNote = sourceTask ? getNoteById(getDb(), sourceTask.noteId) : null
    rolloverAndLog(currentAppDateString())
    const targetNote = ensureTodayNoteFor(
      sourceNote?.title ?? DEFAULT_NOTE_TITLE,
      sourceNote?.colour ?? DEFAULT_NOTE_COLOUR
    )
    const moved = moveTaskToNote(taskId, targetNote.id)
    if (sourceTask) recalculatePerfectDay(getDb(), sourceTask.noteId)
    recalculatePerfectDay(getDb(), targetNote.id)
    logTaskEvent({
      type: 'task.reopened',
      status: moved.status,
      title: moved.title,
      noteTitle: targetNote.title
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
      ? await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory', 'createDirectory']
        })
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
    devDateOffsetDays = getDevDateOffset(getDb())
    ipcMain.handle('dev:simulateNextDay', () => {
      devDateOffsetDays += 1
      setDevDateOffset(getDb(), devDateOffsetDays)
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
