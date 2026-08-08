"""Score history for key results (trend charts, audit)."""
from datetime import datetime
from typing import Optional, Dict, Any


class ScoreHistory:
    def __init__(
        self,
        key_result_id: str,
        score: float,
        recorded_by: str,
        _id: Optional[str] = None,
        notes: Optional[str] = None,
        recorded_at: Optional[datetime] = None,
    ):
        self._id = _id
        self.key_result_id = key_result_id
        self.score = score
        self.notes = notes
        self.recorded_by = recorded_by
        self.recorded_at = recorded_at or datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'keyResultId': self.key_result_id,
            'score': self.score,
            'recordedBy': self.recorded_by,
            'recordedAt': self.recorded_at.isoformat() if isinstance(self.recorded_at, datetime) else self.recorded_at,
        }
        if self._id:
            result['_id'] = str(self._id)
        if self.notes is not None:
            result['notes'] = self.notes
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'ScoreHistory':
        sh = ScoreHistory(
            key_result_id=data.get('keyResultId', data.get('key_result_id', '')),
            score=data['score'],
            recorded_by=data.get('recordedBy', data.get('recorded_by', '')),
            _id=str(data['_id']) if '_id' in data else None,
            notes=data.get('notes'),
        )
        if 'recordedAt' in data:
            val = data['recordedAt']
            sh.recorded_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        return sh
