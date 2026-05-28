from typing import Optional, List
import uuid


MOCK_BRANDS = [
    {
        "id": str(uuid.uuid4()), "name": "Acme Co.", "score": 89,
        "training_examples": 72, "status": "active",
        "prohibited_terms": ["cheap", "guarantee", "best in class", "world-class", "synergy"],
        "tone_dimensions": {"confident": 88, "conversational": 74, "data_driven": 91, "urgent": 62, "empathetic": 55},
    },
    {
        "id": str(uuid.uuid4()), "name": "NovaBrand", "score": 76,
        "training_examples": 34, "status": "training",
        "prohibited_terms": ["cheap", "guaranteed"],
        "tone_dimensions": {"confident": 70, "conversational": 85, "data_driven": 60, "urgent": 45, "empathetic": 80},
    },
]


class BrandVoiceService:
    async def list_brands(self, user_id: str) -> List[dict]:
        return MOCK_BRANDS

    async def score(self, text: str, brand_id: str) -> dict:
        brand = next((b for b in MOCK_BRANDS if b["id"] == brand_id), MOCK_BRANDS[0])
        flagged = [t for t in brand["prohibited_terms"] if t.lower() in text.lower()]
        base = 85
        penalty = len(flagged) * 15
        score = max(0, min(100, base - penalty))
        return {
            "score": score,
            "passed": score >= 75,
            "flagged_terms": flagged,
            "tone_breakdown": brand["tone_dimensions"],
            "suggestions": [f"Remove '{t}' — flagged as prohibited" for t in flagged] if flagged else ["Copy looks clean for this brand."],
        }

    async def ingest_guidelines(self, brand_id: str, file) -> dict:
        content = await file.read()
        word_count = len(content.split()) if isinstance(content, str) else len(content) // 5
        return {
            "brand_id": brand_id,
            "status": "queued_for_training",
            "file_name": file.filename,
            "word_count": word_count,
            "estimated_training_time": "< 2 hours",
        }

    async def create_brand(self, name: str, user_id: str) -> dict:
        brand = {
            "id": str(uuid.uuid4()), "name": name, "score": 0,
            "training_examples": 0, "status": "new",
            "prohibited_terms": [], "tone_dimensions": {},
        }
        MOCK_BRANDS.append(brand)
        return brand
