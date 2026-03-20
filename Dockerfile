# Multi-stage build for DarkLens
# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Build/Run Backend
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend code  
COPY DarkLens/backend /app/backend
WORKDIR /app/backend

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy built frontend to a public directory (backend will serve it)
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create necessary directories  
RUN mkdir -p /app/backend/data

# Expose backend port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV LOG_LEVEL=INFO

# Run backend (in production, frontend is served by the backend)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
