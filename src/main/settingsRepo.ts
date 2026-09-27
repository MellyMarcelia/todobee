// Repository functions for the key/value `settings` table. Kept as plain
// functions over a plain better-sqlite3 Database — same pattern as
// tasksRepo.ts and rollover.ts — so they're testable without Electron.
import type Database from 'better-sqlite3'
import { existsSync } from 'fs'
import type { VaultStatus } from '../shared/types'

const VAULT_PATH_KEY = 'vaultPath'
const DEV_DATE_OFFSET_KEY = 'devDateOffsetDays'

interface SettingRow {
  value: string | null
}

/** Returns the saved Obsidian vault folder path, or null if none has been chosen yet. */
export function getVaultPath(db: Database.Database): string | null {
  const row = db
    .prepare<[string], SettingRow>('SELECT value FROM settings WHERE key = ?')
    .get(VAULT_PATH_KEY)
  return row?.value ?? null
}

/** Saves the chosen Obsidian vault folder path, replacing any previous value. */
export function setVaultPath(db: Database.Database, path: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(VAULT_PATH_KEY, path)
}

/**
 * The saved vault path plus whether that folder still exists on disk right
 * now — the renderer uses `exists` to decide which warning banner to show
 * (no vault chosen yet, vs. a chosen vault that got moved/deleted).
 */
export function getVaultStatus(db: Database.Database): VaultStatus {
  const path = getVaultPath(db)
  return { path, exists: path !== null && existsSync(path) }
}

/** Dev-only: how many days the "move this to the next day" button has shifted the app's date (0 if never used). */
export function getDevDateOffset(db: Database.Database): number {
  const row = db
    .prepare<[string], SettingRow>('SELECT value FROM settings WHERE key = ?')
    .get(DEV_DATE_OFFSET_KEY)
  const offset = Number(row?.value ?? 0)
  return Number.isInteger(offset) ? offset : 0
}

/** Dev-only: saves the date offset so a restart keeps the simulated day. */
export function setDevDateOffset(db: Database.Database, offset: number): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(DEV_DATE_OFFSET_KEY, String(offset))
}
