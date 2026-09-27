# Tripmesh

Multi-agent AI travel planner. Fill out one trip-preferences form and a team of
specialized LLM agents researches flights, hotels, dining, and activities, then
assembles a day-by-day itinerary with real pricing and booking links.

## How it works

1. A signed-in user fills out a multi-step trip form (destination, dates, budget,
   travel style, priorities) in the Next.js client.
2. The client saves the request to Postgres and calls the FastAPI backend to start
   planning.
3. The backend runs six specialist agents in sequence, writing progress to the
   database after each step:
   - **Destination Explorer** — attractions and points of interest (Exa search)
   - **Flight Search** — live pricing via Google Flights scraping (`fast_flights`),
     with a Kayak search-link fallback
   - **Hotel Search** — accommodation options via Firecrawl web scraping, with a
     Kayak fallback
   - **Culinary Guide** — restaurant recommendations (Exa search)
   - **Itinerary Specialist** — day-by-day schedule (Exa + Firecrawl + reasoning
     tools)
   - **Budget Optimizer** — cost breakdown and savings suggestions
4. A final structured-output agent converts the agents' free-text research into a
   single JSON itinerary matching the app's schema.
5. The client polls the backend/Postgres for live status and renders the finished
   itinerary once it's ready.

## Architecture

Two-part monorepo sharing one Postgres database:

```
┌──────────────────────────┐        ┌────────────────────────────────────┐
│ Next.js client            │        │ FastAPI backend                     │
│ (client/)                 │  POST  │ (backend/)                          │
│ /plan (form)  ─────────────────────▶ /api/plan/trigger                  │
│  → saves TripPlan         │        │  → background task:                 │
│  → calls backend          │        │    destination → flight → hotel →   │
│                            │        │    dining → itinerary → budget →    │
│ /plan/[id] (polls status) │◀───────┤    structured-output agent          │
│  → reads status/output    │  DB    │  → writes status/output to DB       │
│    directly via Prisma    │ (shared Postgres)                            │
└──────────────────────────┘        └────────────────────────────────────┘
```

The client reads results directly from Postgres via Prisma; the backend writes to
the same tables via SQLAlchemy. They don't call each other for reads.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS 4, shadcn/Radix UI |
| Auth | better-auth (email/password) + Prisma adapter |
| Client DB access | Prisma ORM |
| Backend API | FastAPI, Uvicorn/Gunicorn |
| Agent framework | [Agno](https://github.com/agno-agi/agno) |
| LLM provider | OpenRouter (Gemini 2.0 Flash, GPT-4o) |
| Research tools | Exa, Firecrawl |
| Flight data | `fast_flights` (Google Flights) |
| Backend DB access | SQLAlchemy 2.0 async engine + asyncpg |
| Deployment | Docker (backend), standalone Next.js build (client) |

## Prerequisites

- Node.js 20+ and pnpm
- Python 3.12 and [`uv`](https://github.com/astral-sh/uv)
- A shared PostgreSQL database — both the client (Prisma) and backend (SQLAlchemy)
  read and write the same `trip_plan`, `trip_plan_status`, `trip_plan_output`, and
  `plan_tasks` tables
- API keys: OpenRouter, Exa, Firecrawl

## Setup

**Backend**
```bash
cd backend
uv sync
cp .env.example .env   # fill in real values
```

**Client**
```bash
cd client
pnpm install
cp .env.example .env   # fill in real values
pnpm prisma migrate deploy
```

## Running locally

**Backend** (port 8000)
```bash
cd backend
python main.py
# or: uvicorn api.app:app --reload --port 8000
```

**Client** (port 3000)
```bash
cd client
pnpm dev
```

Point the client's `BACKEND_API_URL` at `http://localhost:8000` and
`NEXT_PUBLIC_BASE_URL` at `http://localhost:3000` for local development.

## Docker (backend)

```bash
cd backend
docker build -t tripmesh-backend .
docker run -p 8000:8000 --env-file .env tripmesh-backend
```

## Project structure

```
backend/
├── main.py                 # Entrypoint
├── api/app.py               # FastAPI app, CORS, DB lifespan, /api/health
├── router/plan.py            # POST /api/plan/trigger
├── services/
│   ├── plan_service.py       # Orchestration: runs each agent, updates DB status
│   └── db_service.py          # SQLAlchemy engine/session management
├── agents/                     # destination, flight, hotel, food, itinerary,
│                                 budget, structured_output, team (Agno Team)
├── tools/                        # fast_flights wrapper, Kayak URL generators,
│                                   Firecrawl scraper
├── models/                        # Pydantic + SQLAlchemy models
├── repository/                     # DB read/write helpers
├── migrations/                      # SQL DDL
└── config/                           # LLM config, logging

client/
├── app/
│   ├── page.tsx              # Landing page
│   ├── auth/page.tsx          # Sign in / sign up
│   ├── plan/page.tsx           # Trip request form
│   ├── plan/[id]/page.tsx       # Live status + results
│   ├── plans/page.tsx            # Past trip plans
│   └── api/                       # auth, plan submit, plan CRUD/retry routes
├── components/                     # UI components
├── lib/                              # auth, prisma, utils
└── prisma/schema.prisma               # Shared DB schema
```

## Notes

`agents/team.py` defines a full Agno `Team` (coordinate mode) as an alternative
single-call orchestration path. The live request flow in `plan_service.py` calls
each agent directly and sequentially instead, so it can write fine-grained
progress to the database between steps and keep each agent's output separately
addressable in the final itinerary JSON.
