import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from ..core.database import Base


class ContentPiece(Base):
    __tablename__ = "content_pieces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    brand_id = Column(UUID(as_uuid=True), ForeignKey("brands.id"), nullable=True)
    channel = Column(String, nullable=False)
    headline = Column(Text, nullable=True)
    body = Column(Text, nullable=True)
    cta = Column(String, nullable=True)
    brand_score = Column(Integer, nullable=True)
    predicted_ctr = Column(Float, nullable=True)
    actual_ctr = Column(Float, nullable=True)
    actual_roas = Column(Float, nullable=True)
    prompt_context = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Brand(Base):
    __tablename__ = "brands"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    tone_dimensions = Column(JSON, nullable=True)
    prohibited_terms = Column(JSON, nullable=True, default=list)
    voice_score = Column(Integer, nullable=True)
    training_examples = Column(Integer, default=0)
    status = Column(String, default="training")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
