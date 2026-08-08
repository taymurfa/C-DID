"""Workflow state transition events for objectives (audit trail)."""
from datetime import datetime
from typing import Optional, Dict, Any


class WorkflowEvent:
    def __init__(
        self,
        objective_id: str,
        from_status: str,
        to_status: str,
        actor_id: str,
        _id: Optional[str] = None,
        reason: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ):
        self._id = _id
        self.objective_id = objective_id
        self.from_status = from_status
        self.to_status = to_status
        self.actor_id = actor_id
        self.reason = reason
        self.timestamp = timestamp or datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'objectiveId': self.objective_id,
            'fromStatus': self.from_status,
            'toStatus': self.to_status,
            'actorId': self.actor_id,
            'timestamp': self.timestamp.isoformat() if isinstance(self.timestamp, datetime) else self.timestamp,
        }
        if self._id:
            result['_id'] = str(self._id)
        if self.reason is not None:
            result['reason'] = self.reason
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'WorkflowEvent':
        we = WorkflowEvent(
            objective_id=data.get('objectiveId', data.get('objective_id', '')),
            from_status=data.get('fromStatus', data.get('from_status', '')),
            to_status=data.get('toStatus', data.get('to_status', '')),
            actor_id=data.get('actorId', data.get('actor_id', '')),
            _id=str(data['_id']) if '_id' in data else None,
            reason=data.get('reason'),
        )
        if 'timestamp' in data:
            val = data['timestamp']
            we.timestamp = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        return we
