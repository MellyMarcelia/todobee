import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TodayScreen from '../TodayScreen.vue'
import type { Note, Task } from '../../../../shared/types'

// Automatic checks for the opened post-it screen. Run them with "npm test".
//
// These guard against an old bug: typing a task and pressing Enter used to
// add it TWICE. Here's why. The "tap to add…" box saves your task both when
// you press Enter AND when you click away from it. Pressing Enter saved the
// task and closed the box. But closing a box you're typing in counts as
// "clicking away", so it tried to save the same task a second time.
//
// The test below copies exactly those steps (type, press Enter, the box
// closes and "clicks away") and makes sure only ONE task is saved.
// It uses a pretend window.api, so nothing is really saved anywhere.
//
// (Technical version, for developers: the input had both @keyup.enter and
// @blur wired to confirmAddTask. Enter set isAddingTask = false before the
// createTask call resolved, Vue unmounted the still-focused input, and
// that fired a native blur, calling confirmAddTask a second time.)

// A pretend post-it for the screen to show.
const fakeNote: Note = {
  id: 1,
  noteDate: '2026-09-27',
  title: "today's buzz",
  colour: '#F6C56A',
  sealed: false,
  perfectDay: false,
  boardX: null,
  boardY: null,
  createdAt: '2026-09-27 00:00:00'
}

// Makes a pretend (not done) task on that post-it.
function makeTask(id: number, title: string): Task {
  return { id, noteId: fakeNote.id, title, status: 'open', createdAt: '2026-09-27 00:00:00' }
}

describe('TodayScreen - adding a task', () => {
  // Before every test: set up a pretend window.api. Loading gives back the
  // pretend post-it with no tasks, and "create a task" just hands back a
  // pretend task (while counting how many times it was asked).
  beforeEach(() => {
    let nextId = 100
    window.api = {
      getNoteById: vi.fn().mockResolvedValue(fakeNote),
      listTasks: vi.fn().mockResolvedValue([]),
      createTask: vi
        .fn()
        .mockImplementation(async (_noteId: number, input: { title: string }) =>
          makeTask(nextId++, input.title)
        ),
      updateTaskTitle: vi.fn(),
      setTaskStatus: vi.fn(),
      deleteTask: vi.fn()
    } as unknown as Window['api']
  })

  it('creates exactly one task when Enter is pressed once', async () => {
    const wrapper = mount(TodayScreen, { props: { noteId: fakeNote.id } })
    await flushPromises() // let onMounted's loadNote resolve

    await wrapper.find('.task-text.muted').trigger('click') // "tap to add…"
    const input = wrapper.find('.add-row .task-text-input')
    await input.setValue('Write regression test')

    // Press Enter: this saves the task and closes the text box.
    await input.trigger('keyup.enter')

    // In the real app, closing the box while you're typing in it counts as
    // "clicking away". The pretend browser used for tests doesn't do that
    // on its own, so we do it by hand, to copy exactly what the real app did.
    await input.trigger('blur')
    await flushPromises()
    await flushPromises() // let the createTask promise itself resolve too

    // Saved exactly once, and exactly one task shows on screen.
    expect(window.api.createTask).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.task-row').length).toBe(2) // 1 real task + the add-row
  })

  it('does not create a task when Enter is pressed on an empty input', async () => {
    const wrapper = mount(TodayScreen, { props: { noteId: fakeNote.id } })
    await flushPromises()

    await wrapper.find('.task-text.muted').trigger('click')
    const input = wrapper.find('.add-row .task-text-input')
    // leave it empty
    await input.trigger('keyup.enter')
    await input.trigger('blur')
    await flushPromises()
    await flushPromises()

    // Nothing saved, and no task shows on screen.
    expect(window.api.createTask).not.toHaveBeenCalled()
    expect(wrapper.findAll('.task-row').length).toBe(1) // just the add-row
  })
})

// Waits a moment, so anything the screen is still busy doing (loading,
// saving...) gets to finish before we check the results.
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
