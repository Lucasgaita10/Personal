# Installing Stone Gate on a fresh machine

Step-by-step from "I just cloned the repo" to "everything is running". Estimated time: 20–30 minutes the first time (most of it is `pnpm install` and the Docker image pulls).

---

## 1. Prerequisites

Install these on the new machine BEFORE cloning. Versions matter — older versions of Node or Python will hit subtle compatibility issues.

| Tool | Min version | Where to get it |
|---|---|---|
| **Docker Desktop** | 4.30+ | https://docs.docker.com/desktop/ |
| **Node.js** | 20 LTS | https://nodejs.org/ |
| **pnpm** | 9+ | `npm install -g pnpm` after Node is installed |
| **Python** | 3.11+ | https://www.python.org/downloads/ |
| **Git** | any recent | https://git-scm.com/downloads |

Verify each one is on your PATH:

```powershell
docker --version
node --version
pnpm --version
python --version
git --version
```

Start Docker Desktop and wait for the whale icon to stop animating before continuing.

---

## 2. Clone the repository

```powershell
cd "C:\path\where\you\want\the\project"
git clone https://github.com/LucasGaita-VC/Personal.git stone-gate
cd stone-gate
```

First time only, GitHub will prompt you to authenticate — the Git Credential Manager pops up a browser window. Sign in and authorize once.

---

## 3. Configure secrets (`.env`)

The repo ships with a `.env.example` template. Copy it and fill in the real values:

```powershell
Copy-Item .env.example .env
notepad .env
```

You need to fill in:

| Variable | What it is | Where to get |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Claude API key | https://console.anthropic.com/ |
| `JWT_SECRET` | A random 64-character hex string | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MASTER_ENCRYPTION_KEY` | Another random 64-character hex string | Same command as above |
| `POSTGRES_PASSWORD` | Database password (used inside Docker) | Pick anything — it's only reachable from your machine |
| `VOYAGE_API_KEY` | (optional) embeddings provider | https://www.voyageai.com/ — leave blank to use local embeddings |

Everything else can stay at the defaults. **Save and close**.

---

## 4. Start the infrastructure containers

Postgres, Redis, ChromaDB:

```powershell
docker compose up -d postgres redis chroma
```

Wait ~30 seconds for them to be healthy. Verify:

```powershell
docker ps
```

You should see three containers in `Up` state.

---

## 5. Install code dependencies

```powershell
pnpm install
```

This installs Node packages for `apps/web`, `apps/api`, and the shared packages. Takes 3–5 minutes the first time.

---

## 6. Run database migrations

```powershell
pnpm --filter @stone-gate/db prisma:migrate
```

This creates all the tables in Postgres. On success you'll see a list of applied migrations.

---

## 7. (First-time only) Seed the database

Creates the initial admin user so you can log in:

```powershell
pnpm --filter @stone-gate/db seed
```

Default login credentials after seeding:
- **Email**: `admin@stonegate.local`
- **Password**: `changeme`

Change this password from the Settings page after first login.

---

## 8. Build the Python service images

The AI service and doc-processor run in Docker (they have heavy native deps like WeasyPrint and Tesseract):

```powershell
docker compose build ai-service doc-processor
```

Takes 5–10 minutes the first time — it pulls Python base images and installs system libraries.

---

## 9. Start everything

```powershell
docker compose up -d ai-service doc-processor
pnpm dev
```

`pnpm dev` runs the web frontend and the Node API in the foreground with hot reload. Leave it running.

---

## 10. Verify it's working

Open these URLs in a browser:

| URL | What it is |
|---|---|
| http://localhost:3100 | Web app (this is the one you use) |
| http://localhost:4000/healthz | Node API health check (should return JSON `{"ok": true, ...}`) |
| http://localhost:8000/docs | AI service Swagger UI |
| http://localhost:8003/docs | Doc-processor Swagger UI |

Log in at http://localhost:3100/login with the seeded credentials. You should land on the Dashboard.

---

## 11. Restoring data from a backup (optional)

If you're setting up Stone Gate on a new machine and want to restore data from a previous backup folder (e.g. from OneDrive):

```powershell
.\scripts\restore.ps1 -BackupPath D:\path\to\backup\2026-05-12_103045
```

This replays the Postgres dump and unzips the document blobs. See [scripts/BACKUP.md](scripts/BACKUP.md) for details.

If you're starting fresh, skip this — the seeded admin user from Step 7 is enough.

---

## Common issues

**`pnpm install` fails on Windows with permission errors**
PowerShell execution policy. Run once as admin: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`.

**Port 3100 / 4000 / 8000 / 8003 already in use**
Another app is using those ports. Either stop the other app or change the port in `docker-compose.yml` + `.env`.

**Docker says "no space left on device"**
Docker images grew big. Clean up with `docker system prune -a` (removes unused images).

**Prisma migration says "P3014: shadow database"**
Postgres isn't fully up yet. Wait 30 seconds, retry.

**The web app loads but the API returns 401**
Your browser has a stale JWT from a different DB. Clear localStorage (DevTools → Application → Local Storage → clear `sg_token`).

**The AI service fails to start with "Anthropic API key invalid"**
Double-check `.env`. The key must start with `sk-ant-` and have no trailing whitespace.

---

## Stopping everything

```powershell
docker compose down            # stops containers but keeps data
# OR
docker compose down -v         # ALSO deletes the database volume — be careful
```

To restart later: `docker compose up -d` then `pnpm dev`.

---

## Updating Stone Gate to the latest code

```powershell
git pull
pnpm install              # if package.json changed
pnpm --filter @stone-gate/db prisma:migrate    # if schema changed
docker compose build ai-service doc-processor  # if Python deps changed
docker compose up -d
pnpm dev
```

When in doubt, run all four commands above — they're idempotent.
