<#
.SYNOPSIS
    Back up the Stone Gate platform: Postgres database + document blobs.

.DESCRIPTION
    Creates a dated subfolder under -BackupDir containing:
      - db.dump        Postgres custom-format dump (pg_dump -Fc)
      - blobs.zip      Compressed archive of data/blobs (source documents + generated reports)
      - manifest.txt   Plain-text summary of what's in the bundle

    The Postgres dump is captured via `docker exec pg_dump` inside the
    stonegate-postgres container. The blobs are zipped from the host
    BLOB_STORAGE_DIR (defaults to data/blobs under the project root).

    NOT INCLUDED (intentional):
      - .env             secrets live here — back up separately to a password manager
      - ChromaDB volume  vector embeddings can be re-derived by re-ingesting documents
      - node_modules / .next / build artifacts

.PARAMETER BackupDir
    Where to write the dated backup folder. Defaults to <project-root>\backups.

.PARAMETER Retention
    Keep the most recent N backups; older ones are pruned. Defaults to 14.
    Set to 0 to disable pruning.

.PARAMETER Container
    Name of the Postgres container. Defaults to stonegate-postgres.

.EXAMPLE
    .\scripts\backup.ps1
    # Backs up to .\backups\2026-05-12_103045\

.EXAMPLE
    .\scripts\backup.ps1 -BackupDir D:\sg-backups -Retention 30
#>

[CmdletBinding()]
param(
    [string]$BackupDir,
    [int]$Retention = 14,
    [string]$Container = "stonegate-postgres",
    [string]$DbName = "stonegate",
    [string]$DbUser = "stonegate"
)

$ErrorActionPreference = "Stop"

# Resolve project root from script location
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $BackupDir) {
    $BackupDir = Join-Path $projectRoot "backups"
}
$blobsDir = Join-Path $projectRoot "data\blobs"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$target = Join-Path $BackupDir $timestamp
New-Item -ItemType Directory -Path $target | Out-Null

Write-Host "Stone Gate backup -> $target" -ForegroundColor Cyan

# ── 1. Postgres dump ──────────────────────────────────────────────────
Write-Host "  [1/3] Dumping Postgres ($DbName)..." -NoNewline

# Verify container is running
$state = (docker inspect -f '{{.State.Status}}' $Container 2>$null)
if (-not $state -or $state -ne "running") {
    Write-Host " FAIL" -ForegroundColor Red
    throw "Container '$Container' is not running. Start docker-compose first."
}

# Write dump inside the container, then copy it out — avoids PowerShell
# encoding issues that come from piping binary stdout to a file.
$inContainer = "/tmp/sg-db-$timestamp.dump"
docker exec $Container pg_dump -U $DbName -d $DbName --format=custom --no-owner --no-acl -f $inContainer | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE)" }

docker cp "${Container}:${inContainer}" (Join-Path $target "db.dump") | Out-Null
docker exec $Container rm $inContainer | Out-Null

$dumpSize = (Get-Item (Join-Path $target "db.dump")).Length
Write-Host (" ok ({0:N1} MB)" -f ($dumpSize / 1MB)) -ForegroundColor Green

# ── 2. Document blobs ─────────────────────────────────────────────────
Write-Host "  [2/3] Zipping document blobs..." -NoNewline
if (Test-Path $blobsDir) {
    $blobsZip = Join-Path $target "blobs.zip"
    # Compress-Archive uses .NET ZipFile under the hood; OK for files <2GB.
    Compress-Archive -Path (Join-Path $blobsDir "*") -DestinationPath $blobsZip -CompressionLevel Optimal -ErrorAction SilentlyContinue
    if (Test-Path $blobsZip) {
        $zipSize = (Get-Item $blobsZip).Length
        Write-Host (" ok ({0:N1} MB)" -f ($zipSize / 1MB)) -ForegroundColor Green
    } else {
        Write-Host " skipped (empty)" -ForegroundColor Yellow
    }
} else {
    Write-Host " skipped (no blobs dir)" -ForegroundColor Yellow
}

# ── 3. Manifest ───────────────────────────────────────────────────────
$manifest = @"
Stone Gate Backup
=================
Created:    $(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")
Source:     $projectRoot
Container:  $Container
Database:   $DbName

Files
-----
db.dump     Postgres custom-format dump. Restore with:
              docker exec -i $Container pg_restore -U $DbUser -d $DbName --clean --if-exists < db.dump
blobs.zip   Document blobs (uploaded source files + generated reports).
            Extract to data/blobs/ to restore.

NOT included
------------
- .env file (secrets — back up to a password manager)
- ChromaDB embeddings (re-derivable by re-ingesting documents)
- node_modules / .next / build artifacts (re-derive via pnpm install + build)

To restore a full instance, see scripts/restore.ps1 or RESTORE.md.
"@
$manifest | Set-Content -Path (Join-Path $target "manifest.txt") -Encoding UTF8

Write-Host "  [3/3] Manifest written." -ForegroundColor Green

# ── 4. Retention ──────────────────────────────────────────────────────
if ($Retention -gt 0) {
    $all = Get-ChildItem $BackupDir -Directory |
           Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{6}$' } |
           Sort-Object Name -Descending
    if ($all.Count -gt $Retention) {
        $toRemove = $all | Select-Object -Skip $Retention
        foreach ($d in $toRemove) {
            Write-Host "  pruning old backup $($d.Name)" -ForegroundColor DarkGray
            Remove-Item -Recurse -Force $d.FullName
        }
    }
}

Write-Host ""
Write-Host "Backup complete: $target" -ForegroundColor Green
