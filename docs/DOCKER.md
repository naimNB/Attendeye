# Docker Deployment Guide: PUB AttendEye

**Target System:** Localhost Single-Node Docker Deployment (8 GB RAM Laptop)  
**Architecture:** Multi-stage Nginx Frontend Proxy + Multi-stage Python 3.10 FastAPI Backend (CPU Inference)  
**Published Endpoint:** `http://127.0.0.1:8080`  

---

## 1. Architecture & Service Topology

```
+-------------------------------------------------------------------------------+
| Host Browser (Laptop Localhost: http://127.0.0.1:8080)                        |
+-------------------------------------------------------------------------------+
                                     |
                                     v [Port 127.0.0.1:8080 -> Container Port 80]
+-------------------------------------------------------------------------------+
| frontend (Nginx 1.27 Alpine)                                                 |
| - Serves compiled production SPA bundle (/usr/share/nginx/html)               |
| - SPA fallback routing (try_files $uri $uri/ /index.html)                     |
| - Proxies /api/* to http://backend:8000/* with 66M body limit & 300s timeouts |
| - Non-root container process                                                  |
+-------------------------------------------------------------------------------+
                                     |
                                     v [Internal Bridge Network: attendeye-net]
+-------------------------------------------------------------------------------+
| backend (Python 3.10 Bookworm Slim)                                           |
| - Uvicorn ASGI server (0.0.0.0:8000, 1 worker, no reload)                     |
| - Non-root user: appuser (UID/GID 10001:10001)                                |
| - CPU-only InsightFace & MiniFASNet inference (ONNX Runtime)                  |
| - Thread-constrained: OMP_NUM_THREADS=2, OpenBLAS=2, max 2.0 vCPUs, 4 GB RAM  |
| - Persistent SQLite database in named volume: attendeye-data (/app/data)      |
| - Persistent encrypted review crops in named volume: attendeye-private        |
| - Host read-only model mount: ./backend/models:/app/backend/models:ro         |
+-------------------------------------------------------------------------------+
```

### Key Isolation Characteristics
1. **Internal Backend:** The backend container does not publish port 8000 to the host; all public traffic must enter through the Nginx reverse proxy on `127.0.0.1:8080`.
2. **Single Worker Concurrency:** `--workers 1` is strictly maintained to serialize facial inference through the in-process semaphore and prevent SQLite write concurrency deadlocks.
3. **Non-Root Execution:** Both frontend (Nginx unprivileged/worker) and backend (`appuser:appgroup`, UID 10001) run without root privileges.
4. **Clean State by Default:** Container deployment starts with a fresh, persistent database without pre-seeded synthetic or demo data.

---

## 2. Prerequisites & Resource Sizing

- **Operating System:** Linux (Ubuntu 20.04+, Debian 11+, Linux Mint 21+) or Windows WSL2 with Ubuntu.
- **Docker Engine:** Version 24.0+ (Tested with Docker Engine 29.9.2 and Docker Compose v5.6.1).
- **Available RAM:** Minimum 4 GB free (8 GB system RAM). Build images sequentially to prevent memory pressure.
- **Available Disk:** Minimum 6 GB free disk space for Docker image build layers and caching.
- **Model Checkpoints:** Ensure `./backend/models` contains the downloaded ONNX model weights (`insightface/models/buffalo_l/` and `minifasnet.onnx`).

---

## 3. Environment Configuration

The repository includes a configuration template: [`.env.docker.example`](file:///home/mdnaim/Attendeye/.env.docker.example).

### 3.1 Create Configuration File
Copy the example file to `.env.docker` in the repository root:
```bash
cp .env.docker.example .env.docker
```

### 3.2 Generate Cryptographic Keys
Generate strong, distinct cryptographic keys for JWT tokens and Fernet biometric encryption:

```bash
# 1. Generate JWT_SECRET (32+ characters)
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(48))"

# 2. Generate FERNET_KEY (32-byte URL-safe base64 key)
python3 -c "from cryptography.fernet import Fernet; print('FERNET_KEY=' + Fernet.generate_key().decode())"
```

Edit `.env.docker` and insert the generated keys:
```ini
JWT_SECRET=your_generated_jwt_secret_here
FERNET_KEY=your_generated_fernet_key_here
```

### 3.3 Core Configuration Reference

| Parameter | Recommended Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:////app/data/attendeye.db` | Location of SQLite database inside persistent named volume. |
| `PRIVATE_DIR` | `/app/private` | Storage for encrypted temporary thumbnails. |
| `MODEL_ROOT` | `/app/backend/models/insightface` | Location of mounted InsightFace Buffalo_L weights. |
| `MINIFAS_PATH` | `/app/backend/models/minifasnet.onnx` | Location of mounted MiniFASNet anti-spoofing model. |
| `ALLOWED_HOSTS` | `127.0.0.1,localhost,backend,127.0.0.1:8080,localhost:8080` | Host header validation list. |
| `CORS_ORIGINS` | `http://localhost:8080,http://127.0.0.1:8080` | Permitted cross-origin origins for browser requests. |
| `OMP_NUM_THREADS` | `2` | OpenMP execution thread limit for ONNX Runtime. |
| `MAX_REQUEST_MB` | `66` | Maximum multi-frame burst capture payload size. |
| `MAX_UPLOAD_MB` | `8` | Maximum single-frame upload size. |

---

## 4. Sequential Image Build

To build reliably on an 8 GB RAM laptop without running out of memory, build the backend and frontend images sequentially:

```bash
# Step 1: Build the backend container image (compiles InsightFace & NumPy wheels)
sudo docker compose build backend

# Step 2: Build the frontend container image (compiles React/Vite assets & Nginx)
sudo docker compose build frontend
```

*Note: If your local user has been granted Docker access or you use rootless Docker, omit `sudo`.*

---

## 5. Startup & Operational Management

### 5.1 Start the Application Stack
Start both containers in detached mode:
```bash
sudo docker compose up -d
```

### 5.2 Check Service Status
Inspect container health and running state:
```bash
sudo docker compose ps
```
The `backend` container should transition from `starting` to `healthy` within 15–20 seconds as the Uvicorn server passes health checks.

### 5.3 View Service Logs
Stream live container logs:
```bash
# All services
sudo docker compose logs -f

# Backend only
sudo docker compose logs -f backend

# Frontend (Nginx proxy) only
sudo docker compose logs -f frontend
```

### 5.4 Stop the Application
Stop the running stack while preserving all database records and volumes:
```bash
sudo docker compose down
```
> [!CAUTION]
> Do **NOT** run `docker compose down -v` unless you explicitly want to permanently delete all enrolled face embeddings, attendance records, and database tables.

---

## 6. Initial Administrator Account Provisioning

The production Docker container does not automatically seed demo accounts or synthetic attendance records.

To provision the first institutional administrator account, execute the bundled CLI script inside the running backend container:

### Option A: Non-Interactive (Recommended for automation)
```bash
sudo docker compose exec \
  -e ADMIN_EMAIL="admin@university.edu" \
  -e ADMIN_NAME="Institutional Administrator" \
  -e ADMIN_PASSWORD="SecureAdminPassword123!" \
  backend python scripts/create_admin.py
```

### Option B: Interactive Password Prompt
```bash
sudo docker compose exec backend python scripts/create_admin.py \
  --email "admin@university.edu" \
  --name "Institutional Administrator"
```
You will be prompted to enter a password (minimum 10 characters).

Once provisioned, navigate to `http://127.0.0.1:8080/admin/login` and log in with your credentials.

---

## 7. Database Migrations

PUB AttendEye executes schema upgrades automatically during backend startup (`migrate_schema(engine)` in the FastAPI lifespan handler).

If you need to manually execute migrations or inspect the schema:

```bash
# Execute room migration script inside container
sudo docker compose exec backend python scripts/migrate_rooms.py
```

---

## 8. Verification & Sanity Checks

Verify the container deployment using the following checks:

### 8.1 Backend API Health Probe
```bash
curl -s http://127.0.0.1:8080/api/health
```
**Expected Output:**
```json
{"status":"ok","service":"PUB AttendEye"}
```

### 8.2 Frontend Portal Deep Links (SPA Routing)
Verify that Nginx correctly serves `index.html` for client-side routing paths:
```bash
curl -I -s http://127.0.0.1:8080/student/login | grep -E "HTTP/|Content-Type"
curl -I -s http://127.0.0.1:8080/teacher/dashboard | grep -E "HTTP/|Content-Type"
curl -I -s http://127.0.0.1:8080/admin/dashboard | grep -E "HTTP/|Content-Type"
```
**Expected Output:** `HTTP/1.1 200 OK` with `Content-Type: text/html`.

### 8.3 Verify Non-Root User Execution
Verify that the backend process runs under `appuser` (UID 10001):
```bash
sudo docker compose exec backend whoami
sudo docker compose exec backend id
```
**Expected Output:**
```text
appuser
uid=10001(appuser) gid=10001(appgroup) groups=10001(appgroup)
```

### 8.4 Resource Utilization Telemetry
Inspect live CPU and memory consumption:
```bash
sudo docker stats --no-stream
```
Backend idle memory typically hovers around 300–450 MiB (expanding to ~800–1200 MiB during heavy InsightFace burst captures).

---

## 9. Persistent Storage Backup & Restore

All application state is preserved in Docker named volumes:
- `attendeye-data`: Contains `attendeye.db` and SQLite WAL/SHM files.
- `attendeye-private`: Contains encrypted temporary thumbnail crops.

### 9.1 Live SQLite Database Backup
Create an atomic, non-blocking backup of the SQLite database while the container is running:
```bash
# Create SQLite backup file inside the container
sudo docker compose exec backend sqlite3 /app/data/attendeye.db ".backup '/app/data/backup.db'"

# Copy the backup out to the host
sudo docker cp attendeye-backend:/app/data/backup.db ./attendeye_backup_$(date +%F).db

# Remove temporary backup from container volume
sudo docker compose exec backend rm /app/data/backup.db
```

### 9.2 Complete Volume Archive
To backup the entire `attendeye-data` volume into a tarball on the host:
```bash
sudo docker run --rm \
  -v attendeye-data:/data:ro \
  -v "$(pwd)":/backup \
  alpine tar czf /backup/attendeye-data-$(date +%F).tar.gz -C /data .
```

### 9.3 Restoring Volume from Archive
```bash
# Stop application
sudo docker compose down

# Restore data into volume
sudo docker run --rm \
  -v attendeye-data:/data \
  -v "$(pwd)":/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/attendeye-data-YYYY-MM-DD.tar.gz -C /data"

# Restart application
sudo docker compose up -d
```

---

## 10. HTTPS & Smartphone Webcam Policy

> [!IMPORTANT]
> **Browser Secure Context Enforcement (`navigator.mediaDevices.getUserMedia`)**
> Modern mobile and desktop browsers (Google Chrome, Apple Safari, Mozilla Firefox, Microsoft Edge) restrict camera access **strictly to Secure Contexts**:
> 1. `http://localhost` and `http://127.0.0.1` (permitted on the same physical computer).
> 2. `https://...` with a trusted TLS/SSL certificate.

### Local Laptop Use
- When opening `http://127.0.0.1:8080` or `http://localhost:8080` in a browser running on the same laptop, webcam enrollment and face scanning function immediately without SSL configuration.

### Smartphone Check-In Over Local Wi-Fi / LAN
- If students or teachers connect via smartphone to `http://192.168.x.x:8080`, mobile browsers will **block webcam access** and display a permissions error.
- **Solution for LAN / Smartphone Testing:**
  1. **Option A (Reverse Proxy with mkcert):** Set up a local development CA using [mkcert](https://github.com/FiloSottile/mkcert), install the local root certificate on student devices, and configure Nginx or Caddy with TLS.
  2. **Option B (Tunneling):** Run Cloudflare Tunnel (`cloudflared`) or ngrok to expose the local port `8080` over a trusted public HTTPS URL (`https://attendeye.yourdomain.com`).
  3. **Option C (Chrome Flag for Testing):** On Android Chrome, navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<laptop-lan-ip>:8080`, and relaunch Chrome.

---

## 11. Troubleshooting & System Tuning

### 11.1 Nginx 413 "Request Entity Too Large"
- **Symptom:** Multi-photo burst uploads return HTTP 413.
- **Cause:** Nginx `client_max_body_size` is lower than the burst capture payload.
- **Resolution:** `frontend/nginx.conf` is configured with `client_max_body_size 66M;` to match the backend `MAX_REQUEST_MB=66` limit. If you customize payload sizes, ensure both values remain synchronized.

### 11.2 HTTP 400 "Invalid Host Header"
- **Symptom:** API requests return `400 Bad Request` with `Invalid host header`.
- **Cause:** The request `Host` header does not match `ALLOWED_HOSTS`.
- **Resolution:** Update `ALLOWED_HOSTS` in `.env.docker` to include your domain or LAN IP (e.g., `ALLOWED_HOSTS=127.0.0.1,localhost,backend,127.0.0.1:8080,localhost:8080,192.168.1.50:8080`).

### 11.3 Memory Pressure & OOM Kills on 8 GB RAM
- **Symptom:** Container exits with code 137.
- **Resolution:**
  - Verify `OMP_NUM_THREADS=2` in `.env.docker`.
  - Ensure the backend container limit is set to `mem_limit: 4g` in `docker-compose.yml`.
  - Close memory-intensive background host processes (e.g. IDEs, heavy browsers) before running large batch face recognitions.

### 11.4 WSL2 File Permission Anomalies
- On Windows WSL2, mounting Windows host directories (`/mnt/c/...`) can cause Linux permission collisions. Keep the repository inside the WSL2 Linux filesystem (e.g. `/home/user/Attendeye`).
- Docker named volumes (`attendeye-data`, `attendeye-private`) reside natively in the Docker ext4 virtual disk, ensuring optimal I/O throughput and standard Linux POSIX permissions.
