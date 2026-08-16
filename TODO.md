# Engineering Career Copilot — Monorepo Rebuild Checklist

## Monorepo Root
- [x] Create root `.gitignore`

## Backend
- [x] `backend/requirements.txt` — production deps (incl. Clerk JWT verification)
- [x] `backend/database.py` — SQLAlchemy engine/session (SQLite fallback + Postgres)
- [x] `backend/db_models.py` — ChatSession + ChatMessage models
- [x] `backend/app/auth/clerk.py` — Clerk JWT verification dependency
- [x] `backend/app/agent/bot.py` — Gemini + Chroma + DuckDuckGo LangGraph agent
- [x] `backend/app/api/__init__.py`
- [x] `backend/app/api/routes.py` — sessions + chat routers with Clerk auth
- [x] `backend/main.py` — FastAPI app, CORS, health, routers

## Frontend
- [x] `frontend/package.json` — React, Tailwind v4, lucide-react, axios, clerk
- [x] `frontend/postcss.config.js`
- [x] `frontend/vite.config.js` — proxy + Vercel config
- [x] `frontend/src/main.jsx` — ClerkProvider setup
- [x] `frontend/src/App.jsx` — clean chat UI keeping Clerk auth
- [x] `frontend/src/index.css` — Tailwind v4 + dark mode
- [x] `frontend/src/services/api.js` — axios helper with Clerk token interceptor

## Follow-up
- [x] Verify backend imports + routes (all `/api/*` routes registered)
- [x] `npm install` in frontend (0 vulnerabilities)
- [x] `npm run build` in frontend (successful)
- [ ] Add real `.env` values (GEMINI_API_KEY, DATABASE_URL, CLERK keys)
- [ ] Run `uvicorn main:app` + `npm run dev`
