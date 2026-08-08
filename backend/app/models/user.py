"""User model with role and department for OKR permissions."""
from typing import Optional, Dict, Any

ROLE_ADMIN = 'admin'
ROLE_LEADER = 'leader'
ROLE_STANDARD = 'standard'
ROLE_VIEW_ONLY = 'view_only'


class User:
    def __init__(
        self,
        email: str,
        _id: Optional[str] = None,
        name: Optional[str] = None,
        role: str = ROLE_STANDARD,
        department_id: Optional[str] = None,
    ):
        self._id = _id
        self.name = name
        self.email = email
        self.role = role  # admin | leader | standard | view_only
        self.department_id = department_id

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'email': self.email,
            'role': self.role,
        }
        if self._id:
            result['_id'] = str(self._id)
        if self.name is not None:
            result['name'] = self.name
        if self.department_id is not None:
            result['departmentId'] = self.department_id
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'User':
        return User(
            email=data['email'],
            _id=str(data['_id']) if '_id' in data else None,
            name=data.get('name'),
            role=data.get('role', ROLE_STANDARD),
            department_id=data.get('departmentId') or data.get('department_id'),
        )
