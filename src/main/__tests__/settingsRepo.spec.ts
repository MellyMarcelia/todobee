import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import {
  getVaultPath,
  setVaultPath,
  getVaultStatus,
  getDevDateOffset,
  setDevDateOffset
} from '../settingsRepo'

vi.mock('fs', () => {
  const existsSync = vi.fn()
  return { existsSync, default: { existsSync } }
})

describe('settingsRepo', () => {
  let db: Database.Database

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

  it('reports a dev date offset of 0 until one is saved', () => {
    expect(getDevDateOffset(db)).toBe(0)
  })

  it('saves and replaces the dev date offset', () => {
    setDevDateOffset(db, 1)
    setDevDateOffset(db, 3)
    expect(getDevDateOffset(db)).toBe(3)
  })
})
