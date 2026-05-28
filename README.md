# Marketing LLM

Real-Time Intelligence & Self-Learning Marketing Platform.

## Structure

```
marketing-llm/
├── frontend/    # Next.js 14 + TypeScript + Tailwind (Claude-style chat UI)
├── backend/     # FastAPI + Python (content, trends, brand voice, competitive)
└── infra/       # Docker Compose, Postgres schema, Prometheus
```

## Local development

```bash
docker compose up
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend  | http://localhost:8000/docs |
| Grafana  | http://localhost:3001 |

## Deployment

| Layer | Platform | Free tier |
|---|---|---|
| Frontend | Vercel | 100GB BW/mo, instant deploys |
| Backend | Fly.io | 3 shared-cpu VMs, no cold starts |
| Database | Supabase | 500MB Postgres |

### Deploy frontend (Vercel)

```bash
cd frontend
vercel deploy --prod
```

### Deploy backend (Fly.io)

```bash
cd backend
flyctl launch --no-deploy
flyctl secrets set \
  DATABASE_URL=postgres://...supabase... \
  SECRET_KEY=$(openssl rand -hex 32) \
  ANTHROPIC_API_KEY=sk-ant-...
flyctl deploy
```

### Create Supabase Postgres

1. Sign up at https://supabase.com
2. Create a new project → wait ~2 min
3. Copy the connection string (Settings → Database → Connection String → URI)
4. Run `infra/postgres/init.sql` in the SQL editor
