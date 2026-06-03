# AgriSense

AgriSense is a full-stack smart farming assistant for Indian farmers. It combines a React frontend with a Node/Express backend to provide:

- AI chat assistance in English, Hindi, and Punjabi
- Plant disease detection from uploaded images
- Soil image analysis with crop suggestions
- Crop advisory and financial guidance
- Government scheme discovery
- Location-based weather updates
- Farmer profile, farm details, and crop history management

## Repo Structure

```text
.
|-- backend/
|   |-- controllers/
|   |-- data/
|   |-- middleware/
|   |-- models/
|   |-- python-scripts/
|   |-- routes/
|   |-- services/
|   |-- server.js
|   `-- requirements.txt
|-- frontend/
|   |-- public/
|   |-- src/
|   |-- package.json
|   `-- vite.config.js
|-- assets/
`-- uploads/
```

## Tech Stack

- Frontend: React 19, Vite, Tailwind CSS, React Router, Framer Motion
- Backend: Node.js, Express, Mongoose, Multer, JWT
- AI: Groq LLMs, optional Python RAG service with ChromaDB
- Data: MongoDB
- Deployment: Vercel frontend, Render backend

## Key Features

### Frontend

- Login/signup with local auth and Google sign-in
- Multilingual UI and chat flow
- Weather card with location prompt
- Scheme discovery with state filtering
- Chat assistant with voice input/output
- Soil and plant analysis upload flows
- Crop advisory and financial guidance modals
- Farm profile and crop history management

### Backend

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `POST /api/auth/crop-history`
- `DELETE /api/auth/crop-history/:id`
- `GET /api/weather`
- `GET /api/schemes`
- `POST /api/chat`
- `POST /api/analyze-soil`
- `POST /api/analyze-plant`
- `POST /api/crop-advice`
- `POST /api/financial-guidance`
- `POST /api/location-schemes`
- `GET /api/health`

## Environment Setup

### Backend

Create `backend/.env` using `backend/.env.example` as the template.

Important variables:

- `PORT` or `APP_PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `GROQ_API_KEY`
- `TOMORROW_API_KEY`
- `WEATHERAPI_KEY`
- `OPENWEATHERMAP_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLOUD_VISION_KEY`
- `FRONTEND_ORIGINS`
- `CHAT_MODE`
- `RAG_SERVICE_URL`

Notes:

- Weather now prefers `TOMORROW_API_KEY`, then falls back through `WEATHERAPI_KEY`, `OPENWEATHERMAP_KEY`, Open-Meteo, `met.no`, and `wttr.in`.
- AI chat, soil analysis, plant analysis, crop advice, and financial guidance still require a valid `GROQ_API_KEY`.
- If `CHAT_MODE=pure_rag`, the backend can auto-start the Python RAG service when needed.

### Frontend

Create `frontend/.env` using `frontend/.env.example`.

Important variables:

- `VITE_API_URL`
- `VITE_GOOGLE_CLIENT_ID`

If `VITE_API_URL` is missing, the app now auto-selects:

- `http://localhost:4001/api` for local development
- `https://agrisense-backend-h3a6.onrender.com/api` for production hosts

## Local Development

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Start backend

```bash
cd backend
npm run dev
```

Default local API:

```text
http://localhost:4001
```

### 3. Start frontend

```bash
cd frontend
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

### 4. Optional RAG setup

See [backend/RAG_SETUP.md](/C:/Projects2/FarmSaathi/FarmSaathi-main/backend/RAG_SETUP.md).

## Verification Status

The following checks were run in this workspace on June 3, 2026:

- Frontend production build: passed
- Backend JavaScript syntax check: passed
- Local backend health endpoint: passed
- Local weather endpoint: passed
- Local chat endpoint: passed
- Local plant analysis endpoint: passed
- Deployed backend health endpoint: passed
- Deployed backend chat endpoint: passed
- Deployed backend plant analysis endpoint: passed

Issues found during verification:

- Frontend lint currently fails with existing ESLint and prop-types issues.
- Deployed backend weather was failing because `WEATHERAPI_KEY` was not configured in production.
- The voice assistant could silently fail when the browser had not granted microphone access before speech recognition started.
- The repo had no root `README.md`.

## Deployment Notes

Current deployed frontend:

- `https://agri-sense-lime.vercel.app`

Current backend used by the deployed frontend:

- `https://agrisense-backend-h3a6.onrender.com/api`

Recommended uptime monitor targets:

- Frontend home: `https://agri-sense-lime.vercel.app`
- Backend health: `https://agrisense-backend-h3a6.onrender.com/api/health`
- Backend root: `https://agrisense-backend-h3a6.onrender.com`

If Vercel and Render are connected to GitHub auto-deploy, pushing to `main` should trigger a redeploy.

## Why Issues Like This Happen

The main failure modes in this project are operational, not just code bugs:

1. Frontend builds can point to the wrong backend if `VITE_API_URL` is left on a local URL or overridden incorrectly.
2. Protected features depend on a valid JWT token; if the token expires but the UI still thinks the user is logged in, feature requests fail with `401`.
3. Weather depended on a third-party key-based API, so missing quota, missing key, or rate limiting could blank the weather card.
4. Browser speech recognition can fail without a visible error if microphone permission is blocked or if `start()` is called before the browser has granted access.
5. AI features depend on external APIs and can fail if provider credentials are missing, exhausted, or rate-limited.
6. Render free or low-traffic services can cold-start or lag behind Vercel deploy timing.

## Precautions To Prevent Future Breakage

1. Keep a working `VITE_API_URL` in Vercel environment settings and verify it after each deploy.
2. Keep `GROQ_API_KEY`, `TOMORROW_API_KEY`, `WEATHERAPI_KEY`, `OPENWEATHERMAP_KEY`, `GOOGLE_CLIENT_ID`, `MONGODB_URI`, and `JWT_SECRET` configured in Render.
3. Use an uptime monitor on both the frontend home page and backend health endpoint.
4. After every push, verify `auth`, `weather`, `chat`, and one upload-based endpoint from production.
5. Avoid relying on only one external weather provider; keep a keyed primary provider and multi-provider fallbacks, which this repo now does.
6. Test microphone permission and one spoken query after each frontend deploy, especially on Chrome mobile and desktop.
7. Expire bad sessions cleanly by forcing logout on `401` responses instead of silently bouncing users around the app.
8. Keep deploy-time environment variables documented and versioned in `.env.example`, but never commit real secrets.

## Known Gaps

- No automated backend test suite is present.
- No automated frontend integration or e2e suite is present.
- Frontend lint errors should still be cleaned up in a follow-up pass.
- Several advanced features depend on external service credentials and uptime.

## Suggested Next Checks

After deployment, verify:

1. Weather loads on the public homepage.
2. Login/signup works.
3. Chat responds after login.
4. Plant and soil uploads return analysis.
5. Crop advisory and financial guidance respond.
