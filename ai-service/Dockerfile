# orca/ai-service/Dockerfile
# ---------------------------------------------------------------------------
# Production Dockerfile for ORCA AI Service (FastAPI & Multi-Agent Planner)
# ---------------------------------------------------------------------------

FROM python:3.11-slim AS runner

WORKDIR /app

# Install system dependencies if required for spatial/math packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY ai-service/requirements.txt ./ai-service/
RUN pip install --no-cache-dir -r ./ai-service/requirements.txt

# Copy shared contracts and config
COPY contracts ./contracts
COPY shared-config ./shared-config

# Copy AI service source code
COPY ai-service ./ai-service

WORKDIR /app/ai-service

ENV PYTHONPATH=/app/ai-service
ENV ENV=production

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
