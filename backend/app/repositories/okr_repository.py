from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol


def _utcnow():
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class ObjectiveRow:
    id: str
    org_id: str
    department_id: str | None
    team_id: str | None
    owner_user_id: str | None
    title: str
    description: str
    level: str
    status: str
    timeline: str
    fiscal_year: int
    quarter: int | None
    division: str | None
    parent_objective_id: str | None
    next_review_date: datetime | None
    latest_update_summary: str | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class KeyResultRow:
    id: str
    objective_id: str
    title: str
    target: str | None
    current_value: str | None
    unit: str
    score: float | None
    target_score: float
    owner_user_id: str | None
    created_at: datetime
    last_updated_at: datetime


class OKRRepository(Protocol):
    def list_departments(self, user_id: str) -> list[dict[str, Any]]: ...
    def list_objectives(self, user_id: str, filters: dict[str, Any]) -> list[dict[str, Any]]: ...
    def get_objective(self, user_id: str, objective_id: str) -> dict[str, Any] | None: ...
    def create_objective(self, user_id: str, data: dict[str, Any]) -> dict[str, Any]: ...
    def update_objective(self, user_id: str, objective_id: str, data: dict[str, Any]) -> dict[str, Any] | None: ...
    def delete_objective(self, user_id: str, objective_id: str) -> bool: ...

    def get_objective_tree(self, user_id: str, objective_id: str) -> dict[str, Any] | None: ...

    def list_key_results(self, user_id: str, objective_id: str) -> list[dict[str, Any]]: ...
    def get_key_result(self, user_id: str, key_result_id: str) -> dict[str, Any] | None: ...
    def create_key_result(self, user_id: str, data: dict[str, Any]) -> dict[str, Any]: ...
    def update_key_result(self, user_id: str, key_result_id: str, data: dict[str, Any]) -> dict[str, Any] | None: ...
    def delete_key_result(self, user_id: str, key_result_id: str) -> bool: ...

