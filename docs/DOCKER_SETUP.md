# Docker Setup

GRAVITY uses Docker only to run **PostgreSQL 16** and **Redis 7** on your own machine during development ([`docker-compose.yml`](../docker-compose.yml)). Staging and production use Neon and Upstash, so Docker is never part of a deployment.

> You only need Docker once the server starts using the database (Phase 8). The web app, the tests and `/healthz` all work without it.

## 1. Install Docker Desktop

Follow Docker's official guide for your OS:

- Windows: <https://docs.docker.com/desktop/setup/install/windows-install/> (uses WSL 2)
- macOS: <https://docs.docker.com/desktop/setup/install/mac-install/>
- Linux: <https://docs.docker.com/desktop/setup/install/linux/> (or Docker Engine + the Compose plugin)

**Low on disk space on your system drive?** Docker's data disk grows over time. Move it to another drive in Docker Desktop → Settings → Resources → Advanced → **Disk image location**.

Check the install from a new terminal:

```bash
docker --version
```

```bash
docker compose version
```

## 2. Using Docker with GRAVITY

Run everything from the repo root, with Docker Desktop running ("Engine running").

### 2.1 One-time setup

```bash
pnpm install
```

```bash
cp .env.example .env
```

(PowerShell: `Copy-Item .env.example .env`.) The defaults already match `docker-compose.yml`.

### 2.2 Start the services

```bash
pnpm services:up
```

The first run downloads the images (about 150 MB). Check both are healthy:

```bash
docker compose ps
```

`gravity-postgres-1` and `gravity-redis-1` should show `running (healthy)`.

### 2.3 Run the app

```bash
pnpm dev
```

- Web app: <http://localhost:5173>
- Server: <http://localhost:3000/healthz>

If port 5173 is already in use, run the two apps separately: `pnpm --filter @gravity/web dev --port 5174` and `pnpm --filter @gravity/server dev`.

### 2.4 Everyday commands

| What | Command |
| --- | --- |
| Start services | `pnpm services:up` |
| Stop services (data is kept) | `pnpm services:down` |
| Status | `docker compose ps` |
| Logs | `docker compose logs -f postgres` (or `redis`) |
| SQL shell | `docker compose exec postgres psql -U gravity -d gravity` |
| Redis shell | `docker compose exec redis redis-cli` |
| **Delete all local data** and start fresh | `docker compose down -v` ⚠️ removes the database volume |

### 2.5 Connection details (local only)

| Service | URL (already in `.env.example`) |
| --- | --- |
| PostgreSQL | `postgres://gravity:gravity@localhost:5432/gravity` |
| Redis | `redis://localhost:6379` |

Both listen on `127.0.0.1` only. The `gravity`/`gravity` login is for local development; never use it anywhere else.

## 3. Troubleshooting

| Problem | Fix |
| --- | --- |
| `docker: command not found` | Open a new terminal after installing, and make sure Docker Desktop is running |
| `port is already allocated` (5432 or 6379) | Another Postgres/Redis is running (for example a Homebrew `postgresql@16`). Stop it, or pick other ports in `.env`: `POSTGRES_PORT=5433` (and `DATABASE_URL=…@localhost:5433/gravity`) or `REDIS_PORT=6380` (and `REDIS_URL=redis://localhost:6380`), then `pnpm services:up` again |
| Services start but the server can't connect | Check `.env` matches §2.5 and `docker compose ps` shows **healthy** |
| Disk full | `docker system prune` (removes unused images and containers), or move the disk image (§1) |
