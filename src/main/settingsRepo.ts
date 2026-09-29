// Remembers which Obsidian vault folder you picked in Settings, so the app
// knows where to write your task log.
import type Database from 'better-sqlite3'
import { existsSync } from 'fs'
import type { VaultStatus } from '../shared/types'

// The settings table works like a labelled drawer: each setting has a
// name (the "key") and a value. This is the name we store the folder under.
const VAULT_PATH_KEY = 'vaultPath'

// One setting, as the database hands it back to us.
interface SettingRow {
  value: string | null
}

/** The saved vault folder, or nothing (null) if you haven't picked one yet. */
export function getVaultPath(db: Database.Database): string | null {
  const row = db
    .prepare<[string], SettingRow>('SELECT value FROM settings WHERE key = ?')
    .get(VAULT_PATH_KEY)
  return row?.value ?? null
}

/** Saves the folder you picked, replacing the old one if there was one. */
export function setVaultPath(db: Database.Database, path: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(VAULT_PATH_KEY, path)
}

/**
 * The saved folder, plus whether it can still be found on your computer.
 * The screens use this to show the right warning: "pick a folder" or
 * "we can't find your folder any more".
 */
export function getVaultStatus(db: Database.Database): VaultStatus {
  const path = getVaultPath(db)
  return { path, exists: path !== null && existsSync(path) }
}
