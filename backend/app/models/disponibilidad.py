from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class FranjaDisponible(Base):
    __tablename__ = "franjas_disponibles"

    id = Column(Integer, primary_key=True, index=True)
    profesional_id = Column(Integer, ForeignKey("profesionales.id"), nullable=False)
    dia_semana = Column(Integer, nullable=False)   # 0=Lunes … 6=Domingo
    hora_inicio = Column(String(5), nullable=False)  # "HH:MM"
    hora_fin = Column(String(5), nullable=False)

    profesional = relationship("Profesional", back_populates="franjas")
