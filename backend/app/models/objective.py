from datetime import datetime
from typing import Optional, Dict, Any, List

LEVEL_STRATEGIC = 'strategic'
LEVEL_FUNCTIONAL = 'functional'
LEVEL_TACTICAL = 'tactical'
TIMELINE_ANNUAL = 'annual'
TIMELINE_QUARTERLY = 'quarterly'

STATUS_DRAFT = 'draft'
STATUS_IN_REVIEW = 'in_review'
STATUS_APPROVED = 'approved'
STATUS_REJECTED = 'rejected'


class Objective:
    def __init__(
        self,
        title: str,
        owner_id: str,
        level: str,
        timeline: str,
        fiscal_year: int,
        _id: Optional[str] = None,
        description: Optional[str] = None,
        parent_objective_id: Optional[str] = None,
        division: Optional[str] = None,
        quarter: Optional[str] = None,
        status: Optional[str] = None,
        department_id: Optional[str] = None,
        related_objective_ids: Optional[List[str]] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        self._id = _id
        self.title = title
        self.related_objective_ids = related_objective_ids or []
        self.description = description or ''
        self.owner_id = owner_id
        self.level = level  # strategic | functional | tactical
        self.timeline = timeline  # annual | quarterly
        self.fiscal_year = fiscal_year
        self.quarter = quarter  # Q1, Q2, Q3, Q4 when timeline is quarterly
        self.parent_objective_id = parent_objective_id
        self.division = division
        self.status = status or STATUS_DRAFT  # draft | in_review | approved | rejected
        self.department_id = department_id
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'title': self.title,
            'description': self.description,
            'ownerId': self.owner_id,
            'level': self.level,
            'timeline': self.timeline,
            'fiscalYear': self.fiscal_year,
            'status': self.status,
            'createdAt': self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            'updatedAt': self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else self.updated_at,
        }
        if self._id:
            result['_id'] = str(self._id)
        if self.parent_objective_id is not None:
            result['parentObjectiveId'] = self.parent_objective_id
        if self.division is not None:
            result['division'] = self.division
        if self.quarter is not None:
            result['quarter'] = self.quarter
        if self.department_id is not None:
            result['departmentId'] = self.department_id
        if self.related_objective_ids:
            result['relatedObjectiveIds'] = [str(x) for x in self.related_objective_ids]
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Objective':
        obj = Objective(
            title=data['title'],
            owner_id=data.get('ownerId', data.get('owner_id', '')),
            level=data['level'],
            timeline=data['timeline'],
            fiscal_year=data.get('fiscalYear', data.get('fiscal_year', 0)),
            _id=str(data['_id']) if '_id' in data else None,
            description=data.get('description', ''),
            parent_objective_id=data.get('parentObjectiveId') or data.get('parent_objective_id'),
            division=data.get('division'),
            quarter=data.get('quarter'),
            status=data.get('status', STATUS_DRAFT),
            department_id=data.get('departmentId') or data.get('department_id'),
            related_objective_ids=data.get('relatedObjectiveIds') or data.get('related_objective_ids'),
        )
        if 'createdAt' in data:
            val = data['createdAt']
            obj.created_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        elif 'created_at' in data:
            val = data['created_at']
            obj.created_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        if 'updatedAt' in data:
            val = data['updatedAt']
            obj.updated_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        elif 'updated_at' in data:
            val = data['updated_at']
            obj.updated_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        return obj
