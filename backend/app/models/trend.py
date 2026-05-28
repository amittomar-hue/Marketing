import uuid
from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from ..core.database import Base


class Trend(Base):
    __tablename__ = "trends"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    sentiment = Column(String, nullable=True)
    velocity = Column(String, nullable=True)
    mentions = Column(Integer, default=0)
    confidence = Column(Float, nullable=False)
    stage = Column(String, default="emerging")  # emerging|rising|peak|fading
    summary = Column(Text, nullable=True)
    sources = Column(JSON, nullable=True, default=list)
    raw_signals = Column(JSON, nullable=True)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
