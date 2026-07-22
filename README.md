# Transcription Pipeline

A local transcription pipeline with a FastAPI backend and a polished Next.js frontend for uploading audio files or remote audio URLs.

## Features
- Upload audio files and transcribe them locally
- Transcribe remote audio URLs
- Display transcript results with status and metadata
- Simple health check endpoint for local validation

## Run locally

### Backend
```bash
source .venv/bin/activate
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Design decisions

Overview
- The system is split into a lightweight FastAPI backend (transcription and orchestration) and a Next.js frontend (uploads, URL entry, and user status). This separation keeps the API language-idiomatic and allows independent scaling.

Concurrency and uploads
- Clients upload files (or submit audio URLs) using presigned URLs or direct multipart POST. Uploaded objects are stored in durable object storage (S3-compatible) so the API remains stateless. The backend enqueues transcription jobs into a message broker (e.g., RabbitMQ, Redis Streams, or AWS SQS) for worker processing. Workers pull jobs and run transcription on dedicated GPU/CPU instances to avoid blocking HTTP threads.

Storage
- Audio files: store raw audio in S3 with lifecycle rules (30–90 days) to limit cost.
- Transcripts: store structured transcripts in a NoSQL DB (MongoDB, DynamoDB) with text and per-segment timestamps for efficient queries and downstream processing.

Retries and fault recovery
- Use a durable queue with retry/backoff semantics. On worker failure, jobs are retried with exponential backoff and dead-lettered after configurable attempts; failed payloads can be inspected and replayed after fixing root causes.

API design
- REST endpoints implemented by the backend:
	- `GET /health` — service health check
	- `POST /transcribe` — multipart file upload (responds with job id and status)
	- `POST /transcribe-url` — accepts a remote audio URL, downloads it server-side then enqueues a job
	- `GET /v1/jobs/{job_id}` — job status and transcript when available
	- Webhooks: optional callback URL on job creation to notify clients when processing completes

Security and operational notes
- Validate URLs and limit download sizes when accepting remote URLs to avoid SSRF and large downloads.
- Enforce authentication for production (API key or OAuth) and use TLS.

Testing and verification
- The project includes a small test harness under `tests/` which can be run with `pytest` after activating the virtualenv.

If you need a condensed copy of these answers to paste into your Google form, I will provide them below ready-to-copy.
