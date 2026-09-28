# Todobee

A cozy, sticky-note style to-do list with a bee mascot — one corkboard per day, one or more post-its per day, unfinished tasks roll forward automatically. Built as a small offline Electron desktop app for a university course ("Development 5"), used daily to track the author's own software development work all semester.

Todobee logs every task event (created / edited / completed / reopened / deleted) as plain, human-readable markdown into an Obsidian vault of your choosing — an honest, append-only record you actually own, not locked into the app.

Its sibling app, **[Beemodoro](https://github.com/MellyMarcelia/beemodoro)**, is a separate focus-timer app with the same bee theme; the two are fully independent (separate codebases, separate local databases) and only share the same Obsidian vault as an optional common log destination. See `PRD.md` in this repo for the full product spec, technical decisions, and acceptance criteria.

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer (tested on Node 22)
- npm (comes with Node)
- macOS, Windows, or Linux — developed and tested on macOS
- Optional: an [Obsidian](https://obsidian.md/) vault (any folder) if you want task events logged to markdown

## Setup

```bash
git clone https://github.com/MellyMarcelia/todobee.git
cd todobee
npm install
npm run dev
```

That's it — `npm run dev` starts the app in development mode with hot reload. No extra configuration, accounts, or API keys are needed; Todobee works fully offline out of the box.

### Running the tests

```bash
npm test
```

Runs the full Vitest suite (main-process logic: rollover, notes/tasks repos, Obsidian logging, settings, plus a renderer component test) headlessly — no running app required.

### Other useful scripts

```bash
npm run typecheck   # TypeScript, both main and renderer
npm run lint        # ESLint
npm run build       # production build (electron-vite)
npm run build:mac   # packaged macOS app (also build:win, build:linux)
```

## Choosing your Obsidian vault

1. Open **Settings** — either click the ⚙️ gear icon on the board, or press **Cmd+,** (macOS) / **Ctrl+,** (Windows/Linux) from anywhere in the app.
2. Click **Choose vault folder** and pick any folder on disk (an existing Obsidian vault, or any plain folder — Todobee just needs a folder to write into).
3. That's it. The path is saved locally and reused on every future launch. You can change it again at any time from the same screen.

If you skip this step, Todobee still works completely normally — you just won't get a vault log. A banner reminds you logging isn't set up yet. If a previously chosen folder later goes missing (moved, deleted, external drive unplugged), Todobee still works and shows a different warning telling you the folder can't be found.

### Vault folder structure

Todobee writes one append-only markdown file per calendar day, under its own top-level folder in the vault:

```
<your vault>/
  Todobee/
    Tasks/
      2026/
        2026-09/
          2026-09-27.md
          2026-09-28.md
```

Nothing is ever overwritten or rewritten — every event is appended as a new line, even across app restarts and crashes. If Beemodoro (the sibling app) is pointed at the same vault, its own logs live alongside this in a separate `Beemodoro/Focus/...` folder — the two never touch each other's files.

### Example log line

Each line is a single markdown bullet with the full date, time, and timezone inline (never only implied by the filename), plus the event type, status, task title, and which post-it it belongs to:

```markdown
- **2026-09-27 09:03:41 (Europe/Brussels, UTC+02:00)** — `task.created` — Status: open — "Write PRD acceptance criteria" — Note: "today's buzz"
- **2026-09-27 18:47:12 (Europe/Brussels, UTC+02:00)** — `task.completed` — Status: done — "Write PRD acceptance criteria" — Note: "today's buzz"
- **2026-09-28 08:15:03 (Europe/Brussels, UTC+02:00)** — `task.edited` — Status: open — "Finish ER diagram" — Note: "School" — moved from 2026-09-27
```

## Resetting your local data

Todobee stores all its data in one SQLite file, completely separate from your Obsidian vault (the vault only ever receives a write-only markdown export — it's never read back).

**macOS:** `~/Library/Application Support/todobee/todobee.db` (plus `todobee.db-wal` / `todobee.db-shm`, its write-ahead-log companions — always keep all three together)
**Windows:** `%APPDATA%\todobee\todobee.db`
**Linux:** `~/.config/todobee/todobee.db`

To reset your data **without deleting anything**, so you can always undo it:

1. Fully quit Todobee first (a running app can still have the file open).
2. Rename the file rather than deleting it, e.g.:
   ```bash
   mv ~/Library/Application\ Support/todobee/todobee.db ~/Library/Application\ Support/todobee/todobee.db.backup-$(date +%Y%m%d)
   ```
   Do the same for the `-wal` and `-shm` files if present.
3. Launch Todobee again — it will create a brand-new, empty database at the same path automatically.
4. If you ever want your old data back, quit the app, delete/move away the new file, and rename your backup back to `todobee.db` (with its `-wal`/`-shm` companions, if you kept them).

Your Obsidian vault logs are never touched by any of this — they're a separate, independent history.

## Credits

- **Fonts:** [Nunito](https://fonts.google.com/specimen/Nunito) and [Sniglet](https://fonts.google.com/specimen/Sniglet), both via Google Fonts, licensed under the [SIL Open Font License](https://scripts.sil.org/OFL).
- **Bee idle animation** (`bee-idle.gif`): sourced from Giphy; original creator/source not tracked at the time of download.
- **"Good job" stamp graphic** (`good-job-stamp.png`): sourced from Pinterest; original creator/source not tracked at the time of download.
- App icon, all UI/UX design, and all code: built by the author for this project.

If you're either of the above two asset creators and would like proper credit or removal, please open an issue.
