"""Department model for OKR hierarchy (e.g. AI, Data, Ops, Security)."""
from typing import Optional, Dict, Any


class Department:
    def __init__(
        self,
        name: str,
        _id: Optional[str] = None,
    ):
        self._id = _id
        self.name = name

    def to_dict(self) -> Dict[str, Any]:
        result = {'name': self.name}
        if self._id:
            result['_id'] = str(self._id)
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Department':
        return Department(
            name=data['name'],
            _id=str(data['_id']) if '_id' in data else None,
        )
