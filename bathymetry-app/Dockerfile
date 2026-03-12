# ── Stage 1: Build React Frontend ──
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python Backend with real C-SHELPh ──
FROM python:3.11-slim
WORKDIR /app

# System deps for GDAL/Fiona/geopandas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    libgdal-dev \
    gdal-bin \
    libgeos-dev \
    libproj-dev \
    libspatialindex-dev \
    && rm -rf /var/lib/apt/lists/*

# Python deps — the real C-SHELPh stack
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Port
ENV PORT=8080
EXPOSE 8080

# Run
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "300", "--graceful-timeout", "120", "backend.app:app"]
