import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, content, trends, brand_voice, competitive
from .core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Marketing LLM API",
    description="Real-Time Intelligence & Self-Learning Marketing Platform",
    version="0.1.0",
)

allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3002",
]
extra = os.getenv("FRONTEND_ORIGINS", "")
if extra:
    allowed_origins.extend([o.strip() for o in extra.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(content.router, prefix="/api")
app.include_router(trends.router, prefix="/api")
app.include_router(brand_voice.router, prefix="/api")
app.include_router(competitive.router, prefix="/api")


@app.get("/")
def root():
    return {"service": "Marketing LLM API", "version": "0.1.0", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
