# ==============================================================================
# Multi-stage Dockerfile for PUB AttendEye Backend (CPU-Only)
# ==============================================================================

# Stage 1: Build stage with compiler toolchain
FROM python:3.10-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Pinned NumPy and Cython build requirements
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir numpy==1.26.4 Cython==0.29.37

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --no-build-isolation -r /tmp/requirements.txt

# ==============================================================================
# Stage 2: Minimal runtime image without compilers
# ==============================================================================
FROM python:3.10-slim-bookworm AS runner

# Minimal shared libraries needed by OpenCV headless & OpenMP (onnxruntime CPU)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Run as non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/sh -d /app appuser

WORKDIR /app/backend
RUN mkdir -p /app/backend /app/data /app/private /app/backend/models && \
    chown -R appuser:appgroup /app

COPY --chown=appuser:appgroup app /app/backend/app
COPY --chown=appuser:appgroup scripts /app/backend/scripts

USER appuser

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
