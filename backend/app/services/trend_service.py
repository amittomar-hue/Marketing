from typing import Optional, List
from datetime import datetime, timedelta
import uuid


MOCK_TRENDS = [
    {
        "id": str(uuid.uuid4()), "name": "AI-personalized packaging", "velocity": "+240%",
        "confidence": 0.87, "category": "E-commerce", "sentiment": "Positive",
        "mentions": 142000, "stage": "emerging",
        "summary": "Brands using AI to generate individualized packaging designs per customer are seeing 34% higher unboxing video shares.",
        "sources": ["Reddit r/ecommerce", "Shopify Blog", "Twitter/X"],
        "detected_at": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
        "age_label": "2h ago",
    },
    {
        "id": str(uuid.uuid4()), "name": "Interactive video ads", "velocity": "+310%",
        "confidence": 0.91, "category": "Paid Ads", "sentiment": "Positive",
        "mentions": 198000, "stage": "emerging",
        "summary": "Choose-your-own-adventure video ad formats on TikTok are driving 2.4× completion rates vs. static.",
        "sources": ["TikTok Creative Center", "Meta Ad Library", "Marketing Week"],
        "detected_at": (datetime.utcnow() - timedelta(hours=14)).isoformat(),
        "age_label": "14h ago",
    },
]


class TrendService:
    async def list_trends(
        self,
        stage: Optional[str] = None,
        category: Optional[str] = None,
        min_confidence: float = 0.6,
        limit: int = 20,
    ) -> List[dict]:
        results = [
            t for t in MOCK_TRENDS
            if t["confidence"] >= min_confidence
            and (stage is None or t["stage"] == stage)
            and (category is None or t["category"] == category)
        ]
        return results[:limit]

    async def get_detail(self, trend_id: str) -> dict:
        trend = next((t for t in MOCK_TRENDS if t["id"] == trend_id), MOCK_TRENDS[0])
        return {
            "trend": trend,
            "top_posts": [
                {"platform": "Reddit", "text": "This packaging idea is genius", "likes": 2400},
                {"platform": "Twitter/X", "text": "AI packaging personalization is the future", "likes": 890},
            ],
            "audience_quotes": [
                "I actually kept the box because it felt personal",
                "Never seen anything like this from a brand",
            ],
            "geographic_distribution": {"US": 42, "UK": 18, "DE": 12, "CA": 8, "Other": 20},
            "content_brief": f"Create content around {trend['name']} — lean into the personalization angle. Audience resonates with 'made for me' messaging.",
        }

    async def generate_brief(self, trend_id: str) -> str:
        trend = next((t for t in MOCK_TRENDS if t["id"] == trend_id), MOCK_TRENDS[0])
        return (
            f"Campaign Brief — {trend['name']}\n\n"
            f"Trend velocity: {trend['velocity']} over 48h\n"
            f"Key insight: {trend['summary']}\n\n"
            "Recommended angle: Lean into the 'personalization at scale' narrative. "
            "Lead with a data point from the trend to establish credibility, then connect to your product's capability."
        )
