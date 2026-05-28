import time
from typing import Optional
import anthropic
from ..core.config import Settings

CHANNEL_PROMPTS = {
    "google_ads": "Google Search Ads (max 30 char headline, 90 char description). Focus on high intent keywords and clear CTA.",
    "meta": "Meta (Facebook/Instagram) Ads. Focus on thumb-stopping hooks, emotional resonance, clear value prop.",
    "email": "Email marketing. Compelling subject line, preview text, body copy with clear CTA. Conversational tone.",
    "social": "Social media post. Platform-native tone, engaging hook, relevant hashtags, CTA.",
    "landing_page": "Landing page copy. Headline, subheadline, 3 benefit bullets, social proof line, CTA button text.",
    "blog": "Blog article intro + outline. SEO-optimized, thought leadership angle, scannable structure.",
}


class ContentService:
    def __init__(self, settings: Settings):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key) if settings.anthropic_api_key else None
        self.settings = settings

    async def generate(self, payload) -> dict:
        start = time.time()
        channel_instruction = CHANNEL_PROMPTS.get(payload.channel, payload.channel)

        system_prompt = (
            "You are a world-class marketing copywriter. Generate exactly the requested number of "
            "distinct, high-converting content variants. Each variant must be meaningfully different "
            "in angle, hook, or positioning — not just word substitutions. Return JSON only."
        )

        user_prompt = f"""Generate {payload.num_variants} marketing copy variants for:

Channel: {channel_instruction}
Product/Offer: {payload.product}
Target Audience: {payload.audience}
Tone/Angle: {payload.tone or 'confident and data-driven'}
Additional Context: {payload.additional_context or 'none'}

Return a JSON array with {payload.num_variants} objects, each with:
- headline (string)
- body (string)
- cta (string)
- predicted_ctr (string, e.g. "3.8%")
- brand_score (integer 0-100)
"""

        if self.client:
            message = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            import json, re
            raw = message.content[0].text
            json_match = re.search(r'\[.*\]', raw, re.DOTALL)
            variants_data = json.loads(json_match.group()) if json_match else []
        else:
            # Fallback mock when no API key configured
            variants_data = [
                {"headline": f"Variant {i+1}: {payload.product}", "body": f"For {payload.audience}.", "cta": "Learn More", "predicted_ctr": f"{3+i}.{i}%", "brand_score": 80 + i * 3}
                for i in range(payload.num_variants)
            ]

        variants = [
            {
                "id": i + 1,
                "headline": v.get("headline", ""),
                "body": v.get("body", ""),
                "cta": v.get("cta", ""),
                "predicted_ctr": v.get("predicted_ctr"),
                "brand_score": v.get("brand_score"),
                "channel": payload.channel,
            }
            for i, v in enumerate(variants_data)
        ]

        return {
            "variants": variants,
            "generation_time_ms": int((time.time() - start) * 1000),
        }

    async def score_brand_voice(self, text: str, brand_id: Optional[str] = None) -> int:
        # Placeholder: real implementation queries brand profile from DB
        # and runs embedding similarity against voice corpus
        prohibited = ["cheap", "guarantee", "world-class", "synergy"]
        base_score = 85
        for term in prohibited:
            if term.lower() in text.lower():
                base_score -= 15
        return max(0, min(100, base_score))
