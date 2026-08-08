"""File attachments on objectives or key results (soft delete)."""
from datetime import datetime
from typing import Optional, Dict, Any


class Attachment:
    def __init__(
        self,
        objective_id: str,
        file_name: str,
        file_size: int,
        file_type: str,
        url: str,
        uploaded_by: str,
        _id: Optional[str] = None,
        key_result_id: Optional[str] = None,
        uploaded_at: Optional[datetime] = None,
        deleted_at: Optional[datetime] = None,
    ):
        self._id = _id
        self.objective_id = objective_id
        self.key_result_id = key_result_id
        self.file_name = file_name
        self.file_size = file_size
        self.file_type = file_type
        self.url = url
        self.uploaded_by = uploaded_by
        self.uploaded_at = uploaded_at or datetime.utcnow()
        self.deleted_at = deleted_at

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'objectiveId': self.objective_id,
            'fileName': self.file_name,
            'fileSize': self.file_size,
            'fileType': self.file_type,
            'url': self.url,
            'uploadedBy': self.uploaded_by,
            'uploadedAt': self.uploaded_at.isoformat() if isinstance(self.uploaded_at, datetime) else self.uploaded_at,
        }
        if self._id:
            result['_id'] = str(self._id)
        if self.key_result_id is not None:
            result['keyResultId'] = self.key_result_id
        if self.deleted_at is not None:
            result['deletedAt'] = self.deleted_at.isoformat() if isinstance(self.deleted_at, datetime) else self.deleted_at
        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Attachment':
        a = Attachment(
            objective_id=data.get('objectiveId', data.get('objective_id', '')),
            file_name=data.get('fileName', data.get('file_name', '')),
            file_size=data.get('fileSize', data.get('file_size', 0)),
            file_type=data.get('fileType', data.get('file_type', '')),
            url=data['url'],
            uploaded_by=data.get('uploadedBy', data.get('uploaded_by', '')),
            _id=str(data['_id']) if '_id' in data else None,
            key_result_id=data.get('keyResultId') or data.get('key_result_id'),
        )
        if 'uploadedAt' in data:
            val = data['uploadedAt']
            a.uploaded_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        if 'deletedAt' in data and data['deletedAt']:
            val = data['deletedAt']
            a.deleted_at = datetime.fromisoformat(val.replace('Z', '+00:00')) if isinstance(val, str) else val
        return a
