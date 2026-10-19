import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.concurrency import run_in_threadpool
from starlette.formparsers import MultiPartParser
from sqlalchemy.exc import IntegrityError
from .config import settings
from .database import Base, engine, SessionLocal
from .routers import auth, admin, enrol, sessions, attendance, checkin, reports, analytics
from .services.privacy import cleanup
from .services.locks import mutation_lock

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger(__name__)
# Keep accepted multipart images in RAM, not Starlette's default >1 MiB spool-to-disk.
MultiPartParser.spool_max_size = settings.max_request


def cleanup_once() -> None:
    with mutation_lock, SessionLocal() as db:
        cleanup(db); db.commit()


async def cleanup_loop() -> None:
    while True:
        try:
            await run_in_threadpool(cleanup_once)
        except Exception:
            log.error("Thumbnail cleanup failed; inspect storage permissions")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate()
    Base.metadata.create_all(engine)
    settings.private_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    await run_in_threadpool(cleanup_once)
    task = asyncio.create_task(cleanup_loop())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError): await task
    engine.dispose()


class BodyLimit:
    """Bound all bodies, including chunked uploads, before multipart parsing."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        chunks, total = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect": return
            total += len(message.get("body", b""))
            if total > settings.max_request:
                return await JSONResponse({"detail": "Request exceeds upload limit"}, status_code=413)(scope, receive, send)
            chunks.append(message)
            if not message.get("more_body", False): break
        index = 0
        async def replay():
            nonlocal index
            if index < len(chunks):
                item = chunks[index]; index += 1; return item
            return await receive()
        await self.app(scope, replay, send)


app = FastAPI(title="PUB AttendEye", version="1.0.0", lifespan=lifespan)
app.add_middleware(BodyLimit)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                   allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Authorization", "Content-Type"])


@app.middleware("http")
async def headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.exception_handler(ValueError)
async def invalid_value(request: Request, exc: ValueError):
    # Controlled parsing/validation messages only; no image/vector content is logged.
    return JSONResponse({"detail": str(exc)}, status_code=422)


@app.exception_handler(IntegrityError)
async def integrity(request: Request, exc: IntegrityError):
    return JSONResponse({"detail": "Conflicting or duplicate record"}, status_code=409)


@app.exception_handler(Exception)
async def unexpected(request: Request, exc: Exception):
    log.error("Request failed: method=%s error_type=%s", request.method, type(exc).__name__)
    return JSONResponse({"detail": "Operation failed. Check model setup and server configuration."}, status_code=500)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "PUB AttendEye"}


for router in (auth.router, admin.router, enrol.router, sessions.router, attendance.router,
               checkin.router, reports.router, analytics.router):
    app.include_router(router)
