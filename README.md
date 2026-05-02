# LlamaDemo

## Setup Access for Group Members

## Project Structure
- `backend/`: Express server and API routes
- `frontend/public/`: static frontend files (HTML, CSS, JS, media)

### 1) Prerequisites
- Node.js (v18+ recommended)
- npm
- Ollama installed and running

### 2) Clone and install dependencies
```bash
git clone <your-repo-url>
cd LlamaDemo
npm install
```

### 3) Install required local model in Ollama
```bash
ollama pull llama3:latest
```

### 4) Start the app
```bash
npm run dev
```

This starts the backend at `http://localhost:3001` and serves the app files from this project folder.

### Docker (optional)
From the project root:
```bash
docker compose -f backend/docker-compose.yml up --build
```

### 5) Open the app
Go to:
- `http://localhost:3001/index.html`

Upload a PDF, then the app will route to `results.html` and call:
- `POST /api/simplify`
- `GET /api/status`

### 6) Quick access checks
- Backend health: `http://localhost:3001/health`
- Ollama/model status: `http://localhost:3001/api/status`

If `/api/status` says model not available, run:
```bash
ollama pull llama3:latest
```
