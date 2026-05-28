from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from pydantic import BaseModel
from ..routers.auth import get_current_user
from ..services.trend_service import TrendService

router = APIRouter(prefix="/trends", tags=["trends"])


class TrendAlert(BaseModel):
    id: str
    name: str
    velocity: str
    confidence: float
    category: str
    sentiment: str
    mentions: int
    summary: str
    sources: List[str]
    detected_at: str
    age_label: str


class TrendDeepDive(BaseModel):
    trend: TrendAlert
    top_posts: List[dict]
    audience_quotes: List[str]
    geographic_distribution: dict
    content_brief: str


@router.get("/", response_model=List[TrendAlert])
async def list_trends(
    stage: Optional[str] = Query(None, description="emerging|rising|peak|fading"),
    category: Optional[str] = None,
    min_confidence: float = 0.6,
    limit: int = 20,
    current_user=Depends(get_current_user),
):
    service = TrendService()
    return await service.list_trends(stage=stage, category=category, min_confidence=min_confidence, limit=limit)


@router.get("/{trend_id}", response_model=TrendDeepDive)
async def get_trend_detail(trend_id: str, current_user=Depends(get_current_user)):
    service = TrendService()
    return await service.get_detail(trend_id)


@router.post("/{trend_id}/generate-brief")
async def generate_content_brief(trend_id: str, current_user=Depends(get_current_user)):
    service = TrendService()
    brief = await service.generate_brief(trend_id)
    return {"brief": brief}


@router.get("/stats/summary")
async def trend_stats(current_user=Depends(get_current_user)):
    return {
        "detected_48h": 23,
        "avg_confidence": 0.81,
        "alerts_sent": 7,
        "acted_on": 3,
    }
