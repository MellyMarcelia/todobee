import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TodayScreen from '../TodayScreen.vue'
import type { Note, Task } from '../../../../shared/types'

// Regression test for the "adding a task creates two" bug.
//
// Root cause: the "tap to add…" input had both @keyup.enter and @blur
// wired to confirmAddTask. Pressing Enter ran confirmAddTask, which set
// isAddingTask = false *before* the createTask IPC call resolved. Vue
// reacted to that by unmounting the (still-focused) input immediately,
// and removing a focused element from the DOM fires a native blur event —
// which fired confirmAddTask a second time with the same leftover title,
// creating a second task via a second IPC call.
//
// This test exercises exactly that sequence (type title, press Enter,
// let the unmount + its blur event play out) against a fake window.api,
// so it fails the same way a real duplicate would: two createTask calls.

const fakeNote: Note = {
  id: 1,
  noteDate: '2026-09-27',
  sealed: false,
  perfectDay: false,
  createdAt: '2026-09-27 00:00:00'
}

function makeTask(id: number, title: string): Task {
  return { id, noteId: fakeNote.id, title, status: 'open', createdAt: '2026-09-27 00:00:00' }
}

describe('TodayScreen — adding a task', () => {
  beforeEach(() => {
    let nextId = 100
    window.api = {
      getTodayNote: vi.fn().mockResolvedValue(fakeNote),
      listTasks: vi.fn().mockResolvedValue([]),
      createTask: vi.fn().mockImplementation(async (_noteId: number, input: { title: string }) =>
        makeTask(nextId++, input.title)
      ),
      updateTaskTitle: vi.fn(),
      setTaskStatus: vi.fn(),
      deleteTask: vi.fn()
    } as unknown as Window['api']
  })

  it('creates exactly one task when Enter is pressed once', async () => {
    const wrapper = mount(TodayScreen)
    await flushPromises() // let onMounted's loadTodayNote resolve

    await wrapper.find('.task-text.muted').trigger('click') // "tap to add…"
    const input = wrapper.find('.add-row .task-text-input')
    await input.setValue('Write regression test')

    // Enter triggers confirmAddTask, which flips isAddingTask to false and
    // starts the (async) createTask call.
    await input.trigger('keyup.enter')

    // In real Chromium (which Electron runs on), removing the still-focused
    // input from the DOM at this point fires a native blur event — jsdom
    // does not replicate that quirk, so we fire it ourselves to reproduce
    // the exact sequence that caused the duplicate in the real app.
    await input.trigger('blur')
    await flushPromises()
    await flushPromises() // let the createTask promise itself resolve too

    expect(window.api.createTask).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.task-row').length).toBe(2) // 1 real task + the add-row
  })

  it('does not create a task when Enter is pressed on an empty input', async () => {
    const wrapper = mount(TodayScreen)
    await flushPromises()

    await wrapper.find('.task-text.muted').trigger('click')
    const input = wrapper.find('.add-row .task-text-input')
    // leave it empty
    await input.trigger('keyup.enter')
    await input.trigger('blur')
    await flushPromises()
    await flushPromises()

    expect(window.api.createTask).not.toHaveBeenCalled()
    expect(wrapper.findAll('.task-row').length).toBe(1) // just the add-row
  })
})

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
