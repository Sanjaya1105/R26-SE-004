from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from config.settings import settings


engine = None
SessionLocal = None
Base = declarative_base()


def _admin_database_url() -> str:
    return (
        f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@"
        f"{settings.DB_HOST}:{settings.DB_PORT}/"
    )


def get_engine():
    global engine, SessionLocal

    if engine is None:
        admin_engine = create_engine(_admin_database_url(), pool_pre_ping=True)

        try:
            with admin_engine.begin() as connection:
                connection.execute(text(f"CREATE DATABASE IF NOT EXISTS `{settings.DB_NAME}`"))
        finally:
            admin_engine.dispose()

        engine = create_engine(
            settings.SQLALCHEMY_DATABASE_URL,
            pool_pre_ping=True,
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    return engine


def init_db() -> None:
    from models.prediction import CognitiveLoadPrediction  # noqa: F401
    from models.student_lesson_summary import StudentLessonSummary  # noqa: F401
    from models.student_lesson_top_signals import StudentLessonTopSignals  # noqa: F401

    db_engine = get_engine()
    Base.metadata.create_all(bind=db_engine)

    # create_all() does not add columns to an existing table. Keep current
    # installations compatible when this field is introduced after the table
    # has already been created.
    table_name = "student-lesson-top-signals"
    column_names = {column["name"] for column in inspect(db_engine).get_columns(table_name)}
    if "predicted_cognitive_load" not in column_names:
        with db_engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE `student-lesson-top-signals` "
                    "ADD COLUMN predicted_cognitive_load VARCHAR(20) "
                    "NOT NULL DEFAULT 'Unknown' AFTER prediction_id"
                )
            )


def get_db() -> Generator[Session, None, None]:
    session_factory = SessionLocal
    if session_factory is None:
        get_engine()
        session_factory = SessionLocal

    db = session_factory()
    try:
        yield db
    finally:
        db.close()
