// The behind-the-scenes part of the app. It opens the window, and answers
// every request the screens send ("add this task", "load this day",
// "delete this post-it"...). The actual saving and loading happens in the
// *Repo.ts files - this file connects the dots and writes each change to
// your Obsidian log.

// Bring in the tools this file needs: Electron's window/menu/dialog pieces,
// plus our own helpers for the database, the log, dates, post-its and tasks.
import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getDb } from './db'
import { runLaunchRollover } from './rollover'
import { getVaultStatus, setVaultPath } from './settingsRepo'
import { appendTaskEvent } from './obsidianLogger'
import type { TaskEvent } from './obsidianLogger'
import {
  listNotesForDate,
  getNoteById,
  createNote,
  updateNoteTitle,
  setNotePosition,
  deleteNote,
  moveOpenTasksToDate
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

/** Today's date as text, e.g. "2026-09-27", using your computer's clock. */
function todayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Writes one line about a task change into your Obsidian log. */
function logTaskEvent(event: TaskEvent): void {
  appendTaskEvent(getVaultStatus(getDb()).path, event)
}

/**
 * Carries unfinished tasks over from earlier days (see rollover.ts), then
 * writes a "moved from <date>" line in the log for each task that moved.
 */
function rolloverAndLog(dateString: string): ReturnType<typeof runLaunchRollover> {
  // Do the actual carrying-over, then log each task that moved.
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
 * Finds today's post-it with this name and colour, or makes a new one if
 * there isn't one yet.
 */
function ensureTodayNoteFor(title: string, colour: string): ReturnType<typeof createNote> {
  const db = getDb()
  const todayDate = todayDateString()
  // Look through today's post-its for one with the same name and colour.
  const existing = listNotesForDate(db, todayDate).find(
    (note) => note.title === title && note.colour === colour
  )
  if (existing) return existing
  return createNote(db, todayDate, title, colour)
}

// Makes the app window (small, like a phone screen) and loads the screens into it.
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    // Starting size, and the smallest you're allowed to shrink it to.
    width: 440,
    height: 680,
    minWidth: 380,
    minHeight: 580,
    resizable: true,
    // Stay hidden until it's ready (see "ready-to-show" below).
    show: false,
    autoHideMenuBar: true,
    // The cream background colour, shown while the screens are loading.
    backgroundColor: '#FDF3DC',
    // On Linux the window needs its icon set by hand.
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      // Load the "messenger" file (preload/index.ts) so the screens can
      // talk to this part of the app.
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Only show the window once it's drawn, so you don't get a blank white flash.
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Any link that tries to open a new window goes to your normal browser instead.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // While developing, load the screens from the live dev server (so edits
  // show up instantly). In the finished app, load them from the built files.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Everything below runs once the app has finished starting up.
app.whenReady().then(() => {
  // Gives the app its identity on Windows (for the taskbar and notifications).
  electronApp.setAppUserModelId('com.todobee.app')

  // F12 opens the developer tools while developing. In the finished app,
  // Cmd/Ctrl+R is turned off so you can't accidentally reload the page.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // A tiny app menu whose main job is the Cmd+, (Mac) / Ctrl+, (Windows,
  // Linux) shortcut that opens Settings from anywhere. On Windows and Linux
  // the menu bar stays hidden, but the shortcut still works.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          {
            label: 'Settings…',
            accelerator: 'CmdOrCtrl+,',
            click: () => BrowserWindow.getFocusedWindow()?.webContents.send('open-settings')
          },
          { role: 'quit' }
        ]
      }
    ])
  )

  // ---- Tasks ----
  // Each request below does the change, then writes a line to the Obsidian
  // log. If the log can't be written (no folder picked, folder missing...),
  // the task change still works - the log is never allowed to break the app.

  // Get every task on a post-it.
  ipcMain.handle('tasks:list', (_event, noteId: number) => listTasksForNote(noteId))
  // Add a task, re-check the "good job" stamp, then write it in the log.
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
  // Rename a task.
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
  // Tick or un-tick a task.
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
  // Delete a task. We read it first so we still know what to write in the log.
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

  // ---- Post-its ----

  // Load every post-it for one day. dayOffset counts days from today
  // (0 = today, -1 = yesterday, 1 = tomorrow). When loading today, we first
  // carry over yesterday's unfinished tasks so they show up right away.
  ipcMain.handle('notes:getForDay', (_event, dayOffset: number) => {
    // Work out the actual date we're looking at (today + the offset).
    const today = parseDateString(todayDateString())
    const date = addDays(today, dayOffset)
    const dateString = formatDateString(date)
    if (dayOffset === 0) rolloverAndLog(dateString)
    const notes = listNotesForDate(getDb(), dateString)
    // Send back the post-its, the pretty date label, and whether this day
    // is today or in the past (so the board knows what to lock).
    return {
      notes,
      dateLabel: formatLongDate(date),
      dayOffset,
      isToday: dayOffset === 0,
      isPast: dayOffset < 0
    }
  })
  // Fetch one post-it, and save where it got dragged to on the board.
  ipcMain.handle('notes:getById', (_event, noteId: number) => getNoteById(getDb(), noteId))
  ipcMain.handle('notes:setPosition', (_event, noteId: number, x: number, y: number) =>
    setNotePosition(getDb(), noteId, x, y)
  )

  // The "+ new post-it" button. Works for today and future days, but not
  // for past days, since those are locked.
  ipcMain.handle('notes:create', (_event, title: string, colour: string, dayOffset: number) => {
    if (dayOffset < 0) throw new Error('Cannot add a post-it to a past day.')
    // Turn "days from today" into a real date, then make the post-it there.
    const dateString = formatDateString(addDays(parseDateString(todayDateString()), dayOffset))
    return createNote(getDb(), dateString, title, colour)
  })
  // Rename a post-it.
  ipcMain.handle('notes:rename', (_event, noteId: number, title: string) =>
    updateNoteTitle(getDb(), noteId, title)
  )
  // Delete a whole post-it (the ✕ on the board). Locked past post-its can't
  // be deleted. Every task on it gets its own "deleted" line in the log, so
  // nothing disappears without a trace.
  ipcMain.handle('notes:delete', (_event, noteId: number) => {
    const note = getNoteById(getDb(), noteId)
    // Already gone? Nothing to do. Locked? Refuse.
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

  // The "move this to the next day" button. Sends the post-it's unfinished
  // tasks to the same post-it tomorrow. Today's post-it stays open with its
  // finished tasks until the day is really over. Each moved task gets a
  // "moved to <tomorrow>" line in the log.
  ipcMain.handle('notes:moveOpenTasksToNextDay', (_event, noteId: number) => {
    const note = getNoteById(getDb(), noteId)
    // Stop right away if the post-it doesn't exist or is locked.
    if (!note) throw new Error(`No post-it found (id ${noteId}).`)
    if (note.sealed) throw new Error(`"${note.title}" is read-only history.`)
    // Work out tomorrow's date, then move the unfinished tasks there.
    const tomorrow = formatDateString(addDays(parseDateString(todayDateString()), 1))
    const { movedTitles } = moveOpenTasksToDate(getDb(), noteId, tomorrow)
    for (const title of movedTitles) {
      logTaskEvent({
        type: 'task.edited',
        status: 'open',
        title,
        noteTitle: note.title,
        movedTo: tomorrow
      })
    }
    // Tell the screen how many moved, for the "2 tasks moved" message.
    return movedTitles.length
  })

  // You un-ticked a finished task on an old, locked post-it and said "yes,
  // move it to today". Put it on today's post-it with the same name and
  // colour (making one if needed), mark it not done, and log it.
  ipcMain.handle('tasks:moveToToday', (_event, taskId: number) => {
    // Find the task and the old post-it it's sitting on.
    const sourceTask = getTaskById(taskId)
    const sourceNote = sourceTask ? getNoteById(getDb(), sourceTask.noteId) : null
    // Make sure today is fully set up first (carry-over done, default
    // post-it made), so we don't end up with two matching post-its.
    rolloverAndLog(todayDateString())
    const targetNote = ensureTodayNoteFor(
      sourceNote?.title ?? DEFAULT_NOTE_TITLE,
      sourceNote?.colour ?? DEFAULT_NOTE_COLOUR
    )
    const moved = moveTaskToNote(taskId, targetNote.id)
    // Both post-its changed, so re-check the "good job" stamp on each.
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

  // ---- Settings ----

  // Which vault folder is saved, and can it still be found?
  // "Choose folder" opens the normal folder picker and saves your choice.
  // If you press Cancel, nothing changes.
  ipcMain.handle('vault:getStatus', () => getVaultStatus(getDb()))
  ipcMain.handle('vault:chooseFolder', async () => {
    // Attach the folder picker to our window if we can (so it pops up on
    // top of it). You can pick an existing folder or make a new one.
    const mainWindow = BrowserWindow.getFocusedWindow()
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    // Save the folder you picked, and send back its new status.
    const chosenPath = result.filePaths[0]
    setVaultPath(getDb(), chosenPath)
    return getVaultStatus(getDb())
  })

  // Everything's ready - open the window.
  createWindow()

  // On Mac, clicking the dock icon when no window is open opens a new one.
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Closing the window quits the app - except on Mac, where apps usually
// keep running until you press Cmd+Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
