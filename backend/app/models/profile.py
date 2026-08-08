from datetime import datetime
from typing import Optional, Dict, Any

class Profile:
    def __init__(self, userId: str, displayName: str, bio: str = "", 
                 profileImageUrl: Optional[str] = None,
                 _id: Optional[str] = None, 
                 createdAt: Optional[datetime] = None,
                 updatedAt: Optional[datetime] = None):
        self._id = _id
        self.userId = userId
        self.displayName = displayName
        self.bio = bio
        self.profileImageUrl = profileImageUrl
        self.createdAt = createdAt or datetime.utcnow()
        self.updatedAt = updatedAt or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert Profile to dictionary for JSON serialization"""
        result = {
            'userId': self.userId,
            'displayName': self.displayName,
            'bio': self.bio,
            'createdAt': self.createdAt.isoformat() if isinstance(self.createdAt, datetime) else self.createdAt,
            'updatedAt': self.updatedAt.isoformat() if isinstance(self.updatedAt, datetime) else self.updatedAt,
        }
        if self.profileImageUrl:
            result['profileImageUrl'] = self.profileImageUrl
        if self._id:
            result['_id'] = str(self._id)
        return result
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Profile':
        """Create Profile from dictionary"""
        profile = Profile(
            userId=data['userId'],
            displayName=data['displayName'],
            bio=data.get('bio', ''),
            profileImageUrl=data.get('profileImageUrl'),
            _id=str(data['_id']) if '_id' in data else None
        )
        
        if 'createdAt' in data:
            if isinstance(data['createdAt'], datetime):
                profile.createdAt = data['createdAt']
            else:
                profile.createdAt = datetime.fromisoformat(data['createdAt'].replace('Z', '+00:00'))
        
        if 'updatedAt' in data:
            if isinstance(data['updatedAt'], datetime):
                profile.updatedAt = data['updatedAt']
            else:
                profile.updatedAt = datetime.fromisoformat(data['updatedAt'].replace('Z', '+00:00'))
        
        return profile
