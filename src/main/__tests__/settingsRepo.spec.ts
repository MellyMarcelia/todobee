// Automatic checks for saving the Obsidian folder you picked, and for
// checking whether it still exists (settingsRepo.ts). Run them with
// "npm test".
//
// These tests never touch your real saved data. Each one uses a fresh,
// throwaway database that only exists in memory while the test runs.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import { getVaultPath, setVaultPath, getVaultStatus } from '../settingsRepo'

// Swap out the real "does this folder exist on the computer?" check for a
// pretend one. Each test decides what it answers, so we don't need real
// folders on disk.
vi.mock('fs', () => {
  const existsSync = vi.fn()
  return { existsSync, default: { existsSync } }
})

describe('settingsRepo', () => {
  let db: Database.Database

  // Before every test: start again with a brand-new empty database, and
  // reset the pretend folder check.
  beforeEach(() => {
    db = new Database(':memory:')
    createSchema(db)
    vi.clearAllMocks()
  })

  it('returns null when no vault path has been chosen yet', () => {
    expect(getVaultPath(db)).toBeNull()
  })

  it('saves and returns the chosen vault path', () => {
    setVaultPath(db, '/Users/melly/Documents/test-vault')
    expect(getVaultPath(db)).toBe('/Users/melly/Documents/test-vault')
  })

  it('overwrites the previous path when changed again', () => {
    setVaultPath(db, '/Users/melly/Documents/test-vault')
    setVaultPath(db, '/Users/melly/Documents/other-vault')
    expect(getVaultPath(db)).toBe('/Users/melly/Documents/other-vault')
  })

  it('reports no path and not-existing when nothing has been chosen yet', async () => {
    const { existsSync } = await import('fs')
    expect(getVaultStatus(db)).toEqual({ path: null, exists: false })
    expect(existsSync).not.toHaveBeenCalled()
  })

  it('reports exists: true when the saved folder is present on disk', async () => {
    const { existsSync } = await import('fs')
    vi.mocked(existsSync).mockReturnValue(true)
    setVaultPath(db, '/Users/melly/Documents/test-vault')
    expect(getVaultStatus(db)).toEqual({
      path: '/Users/melly/Documents/test-vault',
      exists: true
    })
  })

  it('reports exists: false when the saved folder is missing on disk', async () => {
    const { existsSync } = await import('fs')
    vi.mocked(existsSync).mockReturnValue(false)
    setVaultPath(db, '/Users/melly/Documents/deleted-vault')
    expect(getVaultStatus(db)).toEqual({
      path: '/Users/melly/Documents/deleted-vault',
      exists: false
    })
  })
})
