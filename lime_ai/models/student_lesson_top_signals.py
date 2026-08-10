from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


class StudentLessonTopSignals(Base):
    __tablename__ = "student-lesson-top-signals"
    __table_args__ = (
        UniqueConstraint("student_id", "lesson_id", name="uq_top_signals_student_lesson"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    lesson_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    prediction_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    top_1_signal: Mapped[str | None] = mapped_column(String(255), nullable=True)
    top_1_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    top_1_normalized_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    top_2_signal: Mapped[str | None] = mapped_column(String(255), nullable=True)
    top_2_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    top_2_normalized_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    top_3_signal: Mapped[str | None] = mapped_column(String(255), nullable=True)
    top_3_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    top_3_normalized_value: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
