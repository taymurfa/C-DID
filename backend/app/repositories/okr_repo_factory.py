import os

from app.repositories.okr_repo_mongo import MongoOKRRepository
from app.repositories.okr_repo_postgres import PostgresOKRRepository


def is_postgres_okr_repository() -> bool:
    """Single source of truth for OKR_REPOSITORY (default: postgres)."""
    return (os.getenv("OKR_REPOSITORY") or "postgres").strip().lower() == "postgres"


def get_okr_repository():
    """
    Feature flag for progressive migration:
    - OKR_REPOSITORY=postgres (default when unset)
    - OKR_REPOSITORY=mongo
    """
    if is_postgres_okr_repository():
        return PostgresOKRRepository()
    return MongoOKRRepository()

