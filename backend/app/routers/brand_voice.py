from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from ..routers.auth import get_current_user
from ..services.brand_voice_service import BrandVoiceService

router = APIRouter(prefix="/brand-voice", tags=["brand-voice"])


class BrandProfile(BaseModel):
    id: str
    name: str
    score: int
    training_examples: int
    status: str
    prohibited_terms: List[str]
    tone_dimensions: dict


class ScoreRequest(BaseModel):
    text: str
    brand_id: str


class ScoreResponse(BaseModel):
    score: int
    passed: bool
    flagged_terms: List[str]
    tone_breakdown: dict
    suggestions: List[str]


@router.get("/brands", response_model=List[BrandProfile])
async def list_brands(current_user=Depends(get_current_user)):
    service = BrandVoiceService()
    return await service.list_brands(user_id=str(current_user.id))


@router.post("/brands/{brand_id}/score", response_model=ScoreResponse)
async def score_content(brand_id: str, payload: ScoreRequest, current_user=Depends(get_current_user)):
    service = BrandVoiceService()
    return await service.score(text=payload.text, brand_id=brand_id)


@router.post("/brands/{brand_id}/upload-guidelines")
async def upload_guidelines(
    brand_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    if not file.filename.endswith(".pdf") and not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only PDF or TXT files accepted")
    service = BrandVoiceService()
    result = await service.ingest_guidelines(brand_id=brand_id, file=file)
    return result


@router.post("/brands")
async def create_brand(name: str, current_user=Depends(get_current_user)):
    service = BrandVoiceService()
    brand = await service.create_brand(name=name, user_id=str(current_user.id))
    return brand
