# Local AI Control Center

A local-first workspace for chatting with Ollama models and comparing their responses. The interface is built with React, Vite, and TypeScript; the API uses FastAPI and SQLite. Prompts and saved conversations stay on your machine.

## Requirements

- Python 3.11 or newer
- [uv](https://docs.astral.sh/uv/)
- Node.js 20.19+ or 22.12+
- [Ollama](https://ollama.com/download) installed locally

## Run it from a fresh clone

Open two terminals from the repository root.

### 1. Start Ollama and install a model

Ollama normally runs as a background service. If it is not already running, start it in a terminal:

```sh
ollama serve
```

In another terminal, install any model you want to use, for example:

```sh
ollama pull qwen2.5:7b
```

Model downloads are managed by Ollama. The dashboard does not pull or delete models.

### 2. Start the API

```sh
cd backend
uv sync
uv run python -m app
```

The API listens on `127.0.0.1:8000` by default. Set `LACC_HOST` or `LACC_PORT` in the root `.env` file to change the bind address or port. SQLite data is created under `backend/data/` the first time the API starts.

### 3. Start the frontend

In a second terminal, from the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite (normally <http://127.0.0.1:5173>). The Vite development server proxies `/api` requests to the FastAPI server.

## Configuration

Defaults target Ollama at `http://127.0.0.1:11434`, store SQLite at `backend/data/local-ai-control-center.db`, and bind the API to localhost. Optional settings use the `LACC_` prefix:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LACC_OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama HTTP API address |
| `LACC_DATABASE_URL` | `sqlite:///./data/local-ai-control-center.db` | SQLite database path (relative to `backend/`) |
| `LACC_HOST` | `127.0.0.1` | API bind address |
| `LACC_PORT` | `8000` | API port |
| `LACC_REQUEST_TIMEOUT_SECONDS` | `10` | Ollama connection and request timeout; response reads allow up to 5 minutes |

Copy `.env.example` to `.env` in the repository root to customize settings. Start the API from `backend/` so the relative SQLite path resolves to `backend/data/`. The API’s CORS allowlist is restricted to the local Vite development origins.

The Vite `/api` proxy targets `http://127.0.0.1:8000` by default. If you run the API on another port, set `VITE_API_TARGET` before starting Vite (for example, in PowerShell: `$env:VITE_API_TARGET = 'http://127.0.0.1:18080'`).

## Features

- Ollama connection and installed-model status
- Streaming chat with persistent conversations and messages
- Search, rename, and delete conversations
- Generation time, prompt time, token count, and throughput when Ollama provides them
- Prompt Playground for running one prompt across two to four local models in parallel
- Responsive dark interface with loading, empty, and error states

## Development checks

Run backend tests with mocked Ollama responses (no running Ollama instance required):

```sh
cd backend
uv run python -m pytest
uv run python -m ruff check app tests
```

Build the frontend:

```sh
cd frontend
npm ci
npm run format:check
npm run build
```

## Security and local-first notes

- Keep the API and frontend bound to `127.0.0.1` for local use. Do not expose them to a network without adding authentication and reviewing CORS and access controls.
- The Ollama base URL is configurable for local setups; set it only to an endpoint you trust.
- The API does not provide authentication because it is intended to run locally. Anyone who can access the bound local service can use it.
- Prompts, messages, and conversation titles are stored in the local SQLite database. The database is excluded from version control.
- Chat input and prompt size are capped. Ollama requests have bounded timeouts; long generations can still fail or be cancelled.
- Prompt Playground only accepts models reported as installed by the configured Ollama service. It does not download or delete models.

## Project layout

```text
backend/    FastAPI API, Ollama client, SQLite schema, pytest tests
            pyproject.toml and uv.lock manage the Python environment
frontend/   React + Vite application
```
