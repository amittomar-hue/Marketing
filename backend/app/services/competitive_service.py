from typing import List
import uuid


MOCK_COMPETITORS = [
    {
        "id": str(uuid.uuid4()), "name": "Acme Marketing AI", "domain": "acme-ai.com",
        "last_activity": "2h ago", "ads_running": 14, "content_frequency": "12/week",
        "share_of_voice": 23, "sentiment": "Aggressive",
    },
    {
        "id": str(uuid.uuid4()), "name": "ContentForge", "domain": "contentforge.io",
        "last_activity": "1d ago", "ads_running": 7, "content_frequency": "6/week",
        "share_of_voice": 15, "sentiment": "Educational",
    },
]

MOCK_ALERTS = [
    {"competitor": "Acme Marketing AI", "event": "Launched new Google Ads campaign targeting 'marketing automation'", "time": "2h ago", "severity": "high"},
    {"competitor": "ContentForge", "event": "Published 3 SEO articles targeting your core keywords", "time": "1d ago", "severity": "medium"},
]


class CompetitiveService:
    async def list_competitors(self, user_id: str) -> List[dict]:
        return MOCK_COMPETITORS

    async def add_competitor(self, domain: str, name: str, user_id: str) -> dict:
        competitor = {
            "id": str(uuid.uuid4()), "name": name, "domain": domain,
            "last_activity": "just added", "ads_running": 0,
            "content_frequency": "unknown", "share_of_voice": 0, "sentiment": "Unknown",
        }
        MOCK_COMPETITORS.append(competitor)
        return competitor

    async def get_alerts(self, user_id: str, limit: int = 20) -> List[dict]:
        return MOCK_ALERTS[:limit]

    async def generate_counter_strategies(self, competitor_id: str) -> List[str]:
        competitor = next((c for c in MOCK_COMPETITORS if c["id"] == competitor_id), MOCK_COMPETITORS[0])
        return [
            f"Differentiate from {competitor['name']} by leading with your RLMO capability — campaigns that self-improve.",
            "Shift messaging to precision over volume: 'Right content, right moment' vs their broader angle.",
            "Target the agency segment with multi-brand voice management — a gap this competitor does not address.",
        ]
