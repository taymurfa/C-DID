"""Comments on objectives (Updates feed)."""
from datetime import datetime
from typing import Optional, Dict, Any


class Comment:
    def __init__(
        self,
        objective_id: str,
        author_id: str,
        body: str,
        _id: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ):
        self._id = _id
        self.objective_id = objective_id
        self.author_id = author_id
        self.body = body
        self.created_at = created_at or datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'objectiveId': self.objective_id,
            'authorId': self.author_id,
            'body': self.body,
            'createdAt': self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
        }
        if self._id:
            result['_id'] = str(self._id)
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Comment':
        c = Comment(
            objective_id=data.get('objectiveId', data.get('objective_id', '')),
            author_id=data.get('authorId', data.get('author_id', '')),
            body=data['body'],
            _id=str(data['_id']) if '_id' in data else None,
        )
        if 'createdAt' in data:
            val = data['createdAt']
            c.created_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        return c
