# Dockerization Handoff Document: PUB AttendEye

**Status:** Feature-Frozen Release Candidate  
**Date:** 2026-10-28  
**Scope:** Architecture facts, runtime specifications, environment variables, storage paths, and network constraints required for containerization.  
*(Note: Per release policy, this document specifies all technical parameters. Dockerfiles and Compose configurations will be created in the subsequent deployment task).*

---

## 1. Architectural Overview & Services

PUB AttendEye comprises two primary runtime components:
1. **Backend Service:** FastAPI application executing Python 3.10+ with ONNX Runtime for CPU-based face recognition, liveness inference, SQLite/PostgreSQL persistence, and token-based authentication.
2. **Frontend Service:** React (Vite) single-page application communicating with the backend via REST API (`/api` reverse-proxy prefix in production).

```
+-------------------------------------------------------------+
| Browser Client (Student / Teacher / Admin Portal)           |
+-------------------------------------------------------------+
                         |
                         | HTTPS / localhost (Required for Camera)
                         v
+-------------------------------------------------------------+
| Reverse Proxy (Nginx / Caddy) - Port 80 / 443               |
| - Serves static SPA bundle (frontend/dist)                  |
| - Proxies /api/* to Backend (http://backend:8000/*)         |
+-------------------------------------------------------------+
                         |
                         | HTTP (internal container network)
                         v
+-------------------------------------------------------------+
| Backend Service (FastAPI / Uvicorn) - Port 8000             |
| - Working Dir: /app/backend                                 |
| - Workers: 1 (Single-process bounded inference)             |
| - Persistent Mounts: SQLite DB, models, private thumbnails   |
+-------------------------------------------------------------+
```

---

## 2. Runtime Specifications & Entry Points

### 2.1 Backend Service
- **Runtime:** Python 3.10 or 3.11 (64-bit Linux). Verified on Python 3.10.16.
- **System Dependencies:** `build-essential`, `python3-dev`, `libgl1`, `libglib2.0-0` (for OpenCV headless image decoding).
- **Working Directory:** `/app/backend`  
  > [!IMPORTANT]
  > The backend **must** execute with its current working directory set to the `backend/` directory. Relative paths for `attendeye.db`, model weights, and the `private/` encrypted thumbnail directory are resolved relative to this root.
- **Entry Point Command:**
  ```bash
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
  ```
- **Single-Worker Constraint:**  
  `--workers 1` is strictly mandatory for the following architectural reasons:
  1. Heavy inference is serialized via an in-process `BoundedSemaphore(1)` (`processing_slots`) to prevent CPU thrashing and Out-Of-Memory crashes on multi-core systems.
  2. Write operations to the SQLite database are coordinated through an in-memory `threading.Lock` (`mutation_lock`).
  3. Running multiple worker processes with SQLite leads to `database is locked` concurrency errors and defeats the memory throttling mechanism.

### 2.2 Frontend Service
- **Runtime:** Node.js 20 or 22 LTS. Verified on Node 22.
- **Build Command:**
  ```bash
  cd frontend
  npm ci
  npm run build
  ```
- **Build Output Directory:** `frontend/dist/` (contains `index.html`, minified JS/CSS assets, and icons).
- **Production Serving:**
  - Serve static assets using Nginx or Caddy.
  - Configure Single-Page Application (SPA) routing: fallback all non-file route requests to `/index.html`.
  - Rewrite and proxy `/api/*` requests to the backend container: `http://backend:8000/*`.

---

## 3. Environment Variables & Secret Configuration

The backend reads configuration from environment variables or a `.env` file located in `backend/`:

| Variable | Type | Default Value | Description / Requirements |
|---|---|---|---|
| `JWT_SECRET` | String (Hex/Base64) | *None (Required)* | 256-bit cryptographic secret for signing authentication, check-in ticket, and challenge tokens. Generate via `secrets.token_urlsafe(32)`. |
| `FERNET_KEY` | String (Base64) | *None (Required)* | 32-byte URL-safe base64 key for encrypting stored 512D face embeddings and temporary review thumbnails. Generate via `Fernet.generate_key().decode()`. |
| `DATABASE_URL` | String (URL) | `sqlite:///attendeye.db` | SQLAlchemy connection string. Default is SQLite in the backend working directory. For PostgreSQL: `postgresql+psycopg://user:pass@db:5432/attendeye`. |
| `ALLOWED_HOSTS` | Comma-separated | `127.0.0.1,localhost` | TrustedHostMiddleware allowed host headers. Include container service names and domain names (e.g. `localhost,127.0.0.1,backend,attendeye.local`). |
| `CORS_ORIGINS` | Comma-separated | `http://127.0.0.1:5173,http://localhost:5173` | CORSMiddleware permitted browser origins. Add reverse-proxy origins (e.g. `http://localhost,https://attendeye.univ.edu`). |
| `JWT_MINUTES` | Integer | `60` | Lifespan of access tokens in minutes. |
| `DATA_DIR` | String (Path) | `data` | Base directory for application data storage. |
| `PRIVATE_DIR` | String (Path) | `private` | Directory for encrypted temporary thumbnails awaiting teacher review. Must be writable. |
| `MODEL_ROOT` | String (Path) | `models` | Directory holding downloaded face detection and recognition ONNX models. |
| `FACE_MODEL` | String | `buffalo_l` | Name of the face recognition model pack. |
| `MINIFAS_PATH` | String (Path) | `models/minifas.onnx` | Path to the MiniFASNetV2 ONNX passive anti-spoofing model. |
| `MINIFAS_THRESHOLD` | Float | `0.80` | Liveness probability score cutoff for automatic attendance verification. |
| `MINIFAS_SCALE` | Float | `2.7` | Face bounding box crop expansion multiplier for passive liveness context. |
| `PASSIVE_MIN_SIZE` | Integer | `80` | Minimum pixel height/width required for passive anti-spoofing validation. |
| `BASELINE_AUTO_ACCEPT` | Boolean | `false` | Fallback mode when MiniFASNet model is absent. Keep `false` in production to prevent bypass. |
| `MAX_UPLOAD_MB` | Integer | `8` | Maximum allowable size per uploaded image file in megabytes. |
| `MAX_REQUEST_MB` | Integer | `66` | Maximum allowable total size for multi-frame multipart requests. |
| `MAX_IMAGE_PIXELS` | Integer | `16000000` | 16-megapixel sanity limit to prevent decompression bombs. |
| `DEBUG_RECOGNITION` | Boolean | `false` | Enables teacher-only recognition debug overlays and confidence score telemetry. |

---

## 4. Persistent Storage & Volumes

The following directory paths must be mounted to persistent Docker volumes to avoid data loss across container recreations:

1. **Database Storage:**
   - Path: `/app/backend/attendeye.db` (when using default SQLite).
   - Volume Target: `/app/backend/data/` or volume mount containing `attendeye.db`.
2. **Encrypted Thumbnail Cache:**
   - Path: `/app/backend/private/`
   - Purpose: Stores Fernet-encrypted crops of ambiguous faces requiring teacher review.
   - Note: Unresolved review thumbnails expire after 48 hours; active resolution deletes them immediately.
3. **Model Weight Cache:**
   - Path: `/app/backend/models/`
   - Size: ~300 MB total.
   - Recommendation: Pre-download model weights during container image build using `scripts/download_face_model.py` and `scripts/download_minifas.py`, or mount a persistent volume so weights are not re-fetched on container restart.

---

## 5. CPU Resource Allocation & Inference Sizing

- **Hardware Target:** CPU-only (no GPU/CUDA required).
- **Minimum Compute:** 2 vCPU cores, 4 GB RAM.
- **Recommended Compute:** 4 vCPU cores, 8 GB RAM.
- **Inference Profile:**
  - YuNet face detector + SFace / InsightFace 512D feature extractor execute in C++ via ONNX Runtime.
  - Multi-frame burst requests process 5 to 8 frames sequentially under the single-thread inference semaphore.
  - Execution time per photo capture on modern 4-core CPU: ~300ms–800ms depending on face count and tiling.

---

## 6. Health Check & Diagnostic Endpoints

The backend provides endpoints suitable for Docker `HEALTHCHECK` and load balancer probes:

1. **Liveness Probe (Unauthenticated):**
   - **Method / Path:** `GET /health`
   - **Expected Response:** `HTTP 200 OK`
   - **Body:** `{"status": "ok"}`
   - **Docker HEALTHCHECK example:**
     ```dockerfile
     HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
       CMD curl -f http://localhost:8000/health || exit 1
     ```

2. **System Liveness / Model Status (Authenticated):**
   - **Method / Path:** `GET /liveness/status`
   - **Header:** `Authorization: Bearer <token>`
   - **Response:** Reports whether `minifas` or fallback `baseline` anti-spoofing is currently active.

---

## 7. Camera Access & Browser Secure-Context Requirements

> [!WARNING]
> Web browsers (Google Chrome, Mozilla Firefox, Apple Safari, Microsoft Edge) enforce strict security policies regarding camera access via the `navigator.mediaDevices.getUserMedia` JavaScript API.
> Camera access is permitted **ONLY** in:
> 1. Secure contexts (`https://...` with a trusted TLS certificate).
> 2. Local loopback contexts (`http://localhost` or `http://127.0.0.1`).

### Implications for Docker Deployment:
- **Local Testing on Host Machine:** Browsing to `http://localhost:5173` or `http://localhost:80` functions properly with laptop webcams.
- **LAN / Multi-Device Deployment (e.g., Student Smartphones):**
  - If students connect their phones to `http://<laptop-lan-ip>`, the phone browser **will block camera access**.
  - To enable smartphone check-in, the Docker deployment **must terminate TLS** with a valid or phone-trusted certificate (e.g., Let's Encrypt, mkcert, or an enterprise CA certificate).

---

## 8. Database Migrations & Initialization Order

When starting containers for the first time or after a schema update:
1. Run schema migrations non-destructively:
   ```bash
   python scripts/migrate_rooms.py
   ```
2. (Optional Demo Seeding): To initialize synthetic accounts and sample past sessions:
   ```bash
   python scripts/seed.py --demo-sessions
   ```
   *Note: Read `SEED_PASSWORD` from `.env`. Never commit or expose it.*
3. Execute the server entry point.
