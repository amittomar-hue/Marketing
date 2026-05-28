from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from ..core.config import get_settings
from ..routers.auth import get_current_user
from ..services.content_service import ContentService

router = APIRouter(prefix="/content", tags=["content"])
settings = get_settings()


class ContentRequest(BaseModel):
    channel: str  # google_ads | meta | email | social | landing_page | blog
    product: str
    audience: str
    tone: Optional[str] = None
    additional_context: Optional[str] = None
    brand_id: Optional[str] = None
    num_variants: int = 3


class ContentVariant(BaseModel):
    id: int
    headline: str
    body: str
    cta: str
    predicted_ctr: Optional[str] = None
    brand_score: Optional[int] = None
    channel: str


class ContentResponse(BaseModel):
    variants: List[ContentVariant]
    generation_time_ms: int


@router.post("/generate", response_model=ContentResponse)
async def generate_content(
    payload: ContentRequest,
    current_user=Depends(get_current_user),
):
    service = ContentService(settings)
    try:
        result = await service.generate(payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/score-brand-voice")
async def score_brand_voice(
    text: str,
    brand_id: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    service = ContentService(settings)
    score = await service.score_brand_voice(text, brand_id)
    return {"score": score, "pass": score >= settings.brand_voice_min_score}


@router.get("/history")
def get_content_history(current_user=Depends(get_current_user)):
    # TODO: query DB for this user's generated content
    return {"items": [], "total": 0}
