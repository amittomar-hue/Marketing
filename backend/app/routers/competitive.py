from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from ..routers.auth import get_current_user
from ..services.competitive_service import CompetitiveService

router = APIRouter(prefix="/competitive", tags=["competitive"])


class Competitor(BaseModel):
    id: str
    name: str
    domain: str
    last_activity: str
    ads_running: int
    content_frequency: str
    share_of_voice: int
    sentiment: str


class CompetitorAlert(BaseModel):
    competitor: str
    event: str
    time: str
    severity: str


@router.get("/competitors", response_model=List[Competitor])
async def list_competitors(current_user=Depends(get_current_user)):
    service = CompetitiveService()
    return await service.list_competitors(user_id=str(current_user.id))


@router.post("/competitors")
async def add_competitor(domain: str, name: str, current_user=Depends(get_current_user)):
    service = CompetitiveService()
    return await service.add_competitor(domain=domain, name=name, user_id=str(current_user.id))


@router.get("/alerts", response_model=List[CompetitorAlert])
async def get_alerts(limit: int = 20, current_user=Depends(get_current_user)):
    service = CompetitiveService()
    return await service.get_alerts(user_id=str(current_user.id), limit=limit)


@router.get("/competitors/{competitor_id}/counter-strategies")
async def get_counter_strategies(competitor_id: str, current_user=Depends(get_current_user)):
    service = CompetitiveService()
    strategies = await service.generate_counter_strategies(competitor_id)
    return {"strategies": strategies}
