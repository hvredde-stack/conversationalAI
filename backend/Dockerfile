# Cloud Run container. Buildpacks would also work (`gcloud run deploy --source .`)
# but an explicit Dockerfile gives us control over the runtime and avoids surprises.

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

# Install deps first (better layer caching)
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

# App code
COPY app ./app

# Cloud Run expects the container to listen on $PORT
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
