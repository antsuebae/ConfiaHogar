from sqlalchemy import Column, Integer, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class FechaBloqueada(Base):
    __tablename__ = "fechas_bloqueadas"

    id = Column(Integer, primary_key=True, index=True)
    profesional_id = Column(Integer, ForeignKey("profesionales.id"), nullable=False)
    fecha = Column(Date, nullable=False)

    profesional = relationship("Profesional", back_populates="fechas_bloqueadas")

    __table_args__ = (
        UniqueConstraint("profesional_id", "fecha", name="uq_fecha_bloqueada"),
    )
