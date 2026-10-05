from typing import Dict, Any, Optional, List
from ..repositories.project_repo import LexAIProjectRepository
from ..repositories.folder_repo import LexAIFolderRepository
from ..repositories.file_repo import LexAIFileRepository
from .. import schemas

class ProjectService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.project_repo = LexAIProjectRepository()
        self.folder_repo = LexAIFolderRepository()
        self.file_repo = LexAIFileRepository()

    def create_project(self, employee_code: str, project: schemas.ProjectCreate) -> Dict[str, Any]:
        return self.project_repo.create_project(
            tenant_id=self.tenant_id,
            employee_code=employee_code,
            title=project.title,
            business_unit=project.business_unit
        )

    def update_project_data(self, project_id: str, employee_code: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self.project_repo.update_project_data(
            tenant_id=self.tenant_id,
            project_id=project_id,
            employee_code=employee_code,
            update_data=update_data
        )

    def get_user_projects(self, employee_code: str) -> List[Dict[str, Any]]:
        return self.project_repo.get_user_projects(self.tenant_id, employee_code)

    def get_all_tenant_projects(self) -> List[Dict[str, Any]]:
        return self.project_repo.get_all_tenant_projects(self.tenant_id)

    def get_project(self, project_id: str, employee_code: Optional[str] = None) -> Optional[Dict[str, Any]]:
        return self.project_repo.get_project(self.tenant_id, project_id, employee_code)

    def delete_project(self, project_id: str, employee_code: Optional[str] = None) -> bool:
        return self.project_repo.delete_project(self.tenant_id, project_id, employee_code)

    def get_root_folders(self, employee_code: str) -> List[Dict[str, Any]]:
        return self.folder_repo.get_root_folders(self.tenant_id, employee_code)

    def get_folder_detail(self, folder_id: int, employee_code: str) -> Optional[Dict[str, Any]]:
        return self.folder_repo.get_folder_detail(self.tenant_id, folder_id, employee_code)

    def create_folder(self, employee_code: str, name: str, parent_id: Optional[int] = None) -> Dict[str, Any]:
        return self.folder_repo.create_folder(self.tenant_id, employee_code, name, parent_id)

    def delete_folder(self, folder_id: int, employee_code: str) -> bool:
        return self.folder_repo.delete_folder(self.tenant_id, folder_id, employee_code)

    def create_file(self, employee_code: str, name: str, folder_id: Optional[int], file_type: str, file_path: str, file_size: Optional[int]) -> Dict[str, Any]:
        return self.file_repo.create_file(self.tenant_id, employee_code, name, folder_id, file_type, file_path, file_size)

    def get_files(self, employee_code: str, folder_id: Optional[int] = None) -> List[Dict[str, Any]]:
        return self.file_repo.get_files(self.tenant_id, employee_code, folder_id)

    def get_file(self, file_id: int, employee_code: str) -> Optional[Dict[str, Any]]:
        return self.file_repo.get_file(self.tenant_id, file_id, employee_code)

    def delete_file(self, file_id: int, employee_code: str) -> Optional[Dict[str, Any]]:
        return self.file_repo.delete_file(self.tenant_id, file_id, employee_code)
