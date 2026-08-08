import os
import time
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


_engine = None
_SessionLocal = None


def normalize_database_url(url: str | None) -> str | None:
    """
    Render, Railway, etc. often provide postgresql:// or postgres://. This app uses psycopg3
    (SQLAlchemy URL postgresql+psycopg://...).
    """
    if not url:
        return url
    u = url.strip()
    if u.startswith("postgres://"):
        u = "postgresql://" + u[len("postgres://") :]
    if u.startswith("postgresql://") and not u.startswith("postgresql+psycopg://"):
        return "postgresql+psycopg://" + u[len("postgresql://") :]
    return u


def run_alembic_migrations(max_retries: int = 30, delay_sec: float = 1.0) -> None:
    """
    Apply Alembic migrations to head. Retries while Postgres is still starting (e.g. Docker).
    """
    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parent.parent.parent
    ini_path = backend_dir / "alembic.ini"
    cfg = Config(str(ini_path))
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))

    for attempt in range(max_retries):
        try:
            command.upgrade(cfg, "head")
            print("Alembic: database schema is up to date (head).", flush=True)
            return
        except Exception as e:
            msg = str(e).lower()
            transient = any(
                x in msg
                for x in (
                    "connection refused",
                    "could not connect",
                    "server closed",
                    "timeout",
                    "name or service not known",
                )
            )
            if not transient or attempt == max_retries - 1:
                raise
            time.sleep(delay_sec)


def init_pg():
    """
    Initialize SQLAlchemy engine + session factory.

    Uses DATABASE_URL, e.g. postgresql+psycopg://user:pass@localhost:5432/okr
    """
    global _engine, _SessionLocal
    database_url = normalize_database_url(os.getenv("DATABASE_URL"))
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")

    # pool_pre_ping helps with stale connections (common in serverless/containers)
    _engine = create_engine(database_url, pool_pre_ping=True, future=True)
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)
    return _engine


def get_engine():
    global _engine
    if _engine is None:
        init_pg()
    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        init_pg()
    return _SessionLocal


@contextmanager
def pg_session():
    SessionLocal = get_session_factory()
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

