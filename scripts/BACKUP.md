# Stone Gate Backup & Restore

Quick reference for `scripts/backup.ps1` and `scripts/restore.ps1`.

## What's in a backup

Each backup is a single dated folder containing:

| File | Source | Restorable? |
|---|---|---|
| `db.dump` | `pg_dump -Fc` from the `stonegate-postgres` container | Yes — see Restore below |
| `blobs.zip` | `data/blobs/` (uploaded documents + generated PDFs/PPTX) | Yes — unzip to `data/blobs/` |
| `manifest.txt` | Plain-text summary | Reference only |

## What is NOT backed up (intentionally)

- **`.env`** — contains the Anthropic API key, JWT secret, DB password. Keep this in 1Password / Bitwarden, not in a tarball on disk.
- **ChromaDB** — vector embeddings are derivable. After a restore, re-process documents from the UI to rebuild them.
- **`node_modules/`, `.next/`, build artifacts** — re-derive with `pnpm install` and `pnpm dev` / `pnpm build`.

If you also want a code backup: `git init` the repo and push to a private GitHub/GitLab remote. The monorepo currently is not a git repo — fixing that is the single biggest reliability win you can make.

## Running a backup

From the project root:

```powershell
.\scripts\backup.ps1
```

Default behavior:
- Writes to `.\backups\YYYY-MM-DD_HHmmss\`
- Keeps the most recent 14 backups, prunes older ones

Override either:

```powershell
.\scripts\backup.ps1 -BackupDir D:\sg-backups -Retention 30
```

Typical runtime: a few seconds for the dump + however long zipping the blobs takes (~5s per 100MB of documents).

## Restoring from a backup

```powershell
.\scripts\restore.ps1 -BackupPath .\backups\2026-05-12_103045
```

The script will:
1. Prompt for confirmation (type `restore`)
2. Drop existing tables and reload from `db.dump`
3. Move the current `data/blobs/` aside (with a `.replaced-…` suffix) and unzip the backup over it

Skip parts with `-SkipBlobs` or `-SkipDb`. Skip the confirmation with `-Force` (script-friendly, dangerous interactively).

## Scheduling daily backups (Windows Task Scheduler)

1. Open Task Scheduler → Create Basic Task
2. Trigger: Daily, e.g. 02:00
3. Action: **Start a program**
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File "C:\Users\Vantage Capital\OneDrive - Vantage Capital\Desktop\Supporting Folder\IT\RE\scripts\backup.ps1"`
   - Start in: the project root
4. Settings → "Run whether user is logged on or not", "Run with highest privileges" (so Docker is reachable)

The script returns a non-zero exit code on failure, so Task Scheduler will surface errors in its history.

## Off-machine backups

The `backups/` folder sits inside the OneDrive-synced path, so it gets replicated to the cloud automatically. If you want explicit off-site copies, also rsync / `robocopy` it to a separate drive or S3 bucket. The dumps are compressed and small (a few MB of DB, however much your documents weigh).

## Recovery drill (recommended every few months)

1. Stand up a throwaway Postgres container on a different port
2. Restore the latest `db.dump` to it
3. Spot-check a few rows (`SELECT count(*) FROM "Opportunity"` etc.)
4. Confirm a sample blob extracts cleanly from `blobs.zip`

A backup you've never restored is not a backup.
