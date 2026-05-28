# Realtime Docs app

This workspace contains a static frontend (suitable for GitHub Pages) and a Node.js backend you can deploy to Railway (or any Node host).

Overview
- Frontend: static files in the repo root (`index.html`, `main.js`, `styles.css`) — host on GitHub Pages.
- Backend: `server/` — Express + Socket.IO + Postgres. Deploy to Railway and set `DATABASE_URL`.

Local development
1. Start Postgres (or use a hosted DB). Ensure `DATABASE_URL` is set.
2. From `server/`:
```bash
cd server
npm install
npm run dev
```
3. Open the static `index.html` (or serve it with `live-server`) and set `window.SERVER_URL` in the page to your server base URL.

Deploying backend to Railway
1. Create a new Project on Railway and connect a Postgres plugin.
2. Deploy the `server/` code and set environment variables:
   - `DATABASE_URL` (provided by Railway)
3. After deployment, copy the app URL and put it into `index.html` in the `window.SERVER_URL` variable or set it via your deployment pipeline.

Deploying frontend to GitHub Pages
1. Commit the repo and push to GitHub.
2. In repository settings, enable GitHub Pages and choose `gh-pages` branch or `main`/`root` depending on your preference.

Notes on realtime editing
- This implementation uses Socket.IO to broadcast full-document edits to other clients. It's intentionally simple (last-write-wins). For production you may want to adopt a CRDT/OT library for finer-grained real-time merging.
