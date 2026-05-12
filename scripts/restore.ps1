<#
.SYNOPSIS
    Restore a Stone Gate backup created by scripts\backup.ps1.

.DESCRIPTION
    Restores db.dump into Postgres (DROP existing rows via --clean) and
    extracts blobs.zip back into data/blobs/.

    This is destructive: existing rows in the target database are dropped
    and replaced. You will be prompted to confirm before any change.

.PARAMETER BackupPath
    Path to the dated backup folder (e.g. backups\2026-05-12_103045).
    Must contain db.dump (and optionally blobs.zip).

.PARAMETER Container
    Postgres container name. Defaults to stonegate-postgres.

.PARAMETER SkipBlobs
    Restore only the database; leave data/blobs/ alone.

.PARAMETER SkipDb
    Restore only the blobs; leave the database alone.

.PARAMETER Force
    Skip the confirmation prompt. Use with care.

.EXAMPLE
    .\scripts\restore.ps1 -BackupPath .\backups\2026-05-12_103045
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,

    [string]$Container = "stonegate-postgres",
    [string]$DbName = "stonegate",
    [string]$DbUser = "stonegate",

    [switch]$SkipBlobs,
    [switch]$SkipDb,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$blobsDir = Join-Path $projectRoot "data\blobs"

if (-not (Test-Path $BackupPath)) {
    throw "Backup path does not exist: $BackupPath"
}

$dumpFile = Join-Path $BackupPath "db.dump"
$blobsZip = Join-Path $BackupPath "blobs.zip"
$hasDb = (-not $SkipDb) -and (Test-Path $dumpFile)
$hasBlobs = (-not $SkipBlobs) -and (Test-Path $blobsZip)

if (-not $hasDb -and -not $hasBlobs) {
    throw "Nothing to restore (no db.dump or blobs.zip found, or both skipped)."
}

# Confirmation
Write-Host "About to restore from: $BackupPath" -ForegroundColor Cyan
if ($hasDb)    { Write-Host "  - Database $DbName will be DROPPED and replaced from db.dump" -ForegroundColor Yellow }
if ($hasBlobs) { Write-Host "  - data/blobs contents will be REPLACED from blobs.zip"        -ForegroundColor Yellow }
if (-not $Force) {
    $confirm = Read-Host "Type 'restore' to continue, anything else to abort"
    if ($confirm -ne "restore") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
}

# ── Database ──────────────────────────────────────────────────────────
if ($hasDb) {
    Write-Host "Restoring database..." -ForegroundColor Cyan
    $state = (docker inspect -f '{{.State.Status}}' $Container 2>$null)
    if (-not $state -or $state -ne "running") {
        throw "Container '$Container' is not running."
    }

    $inContainer = "/tmp/sg-restore.dump"
    docker cp $dumpFile "${Container}:${inContainer}" | Out-Null
    # --clean --if-exists drops objects before recreating; --no-owner skips role assignments
    docker exec $Container pg_restore -U $DbUser -d $DbName --clean --if-exists --no-owner $inContainer
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  pg_restore returned non-zero (this is normal for first-time drops). Verify data manually." -ForegroundColor Yellow
    }
    docker exec $Container rm $inContainer | Out-Null
    Write-Host "  database restored." -ForegroundColor Green
}

# ── Blobs ─────────────────────────────────────────────────────────────
if ($hasBlobs) {
    Write-Host "Restoring blobs..." -ForegroundColor Cyan
    if (Test-Path $blobsDir) {
        # Move existing aside rather than delete, in case the user wants to recover.
        $stashed = "${blobsDir}.replaced-$(Get-Date -Format yyyyMMddHHmmss)"
        Rename-Item -Path $blobsDir -NewName (Split-Path $stashed -Leaf)
        Write-Host "  prior blobs moved to $stashed" -ForegroundColor DarkGray
    }
    New-Item -ItemType Directory -Path $blobsDir | Out-Null
    Expand-Archive -Path $blobsZip -DestinationPath $blobsDir -Force
    Write-Host "  blobs restored." -ForegroundColor Green
}

Write-Host ""
Write-Host "Restore complete." -ForegroundColor Green
Write-Host "Reminder: ChromaDB embeddings are NOT in the backup — they'll be"
Write-Host "rebuilt automatically when documents are re-processed, or you can"
Write-Host "trigger a re-ingest from the UI."
