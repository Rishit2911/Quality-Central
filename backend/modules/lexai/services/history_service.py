from typing import Dict, Any, Optional, List
from ..repositories.project_repo import LexAIProjectRepository
from .. import schemas

repo = LexAIProjectRepository()

def create_project(tenant_id: str, employee_code: str, project: schemas.ProjectCreate) -> Dict[str, Any]:
    return repo.create_project(
        tenant_id=tenant_id,
        employee_code=employee_code,
        title=project.title,
        business_unit=project.business_unit
    )

def update_project_data(tenant_id: str, project_id: str, employee_code: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return repo.update_project_data(
        tenant_id=tenant_id,
        project_id=project_id,
        employee_code=employee_code,
        update_data=update_data
    )

def get_user_projects(tenant_id: str, employee_code: str) -> List[Dict[str, Any]]:
    return repo.get_user_projects(tenant_id=tenant_id, employee_code=employee_code)

def get_all_tenant_projects(tenant_id: str) -> List[Dict[str, Any]]:
    return repo.get_all_tenant_projects(tenant_id=tenant_id)

def get_project(tenant_id: str, project_id: str, employee_code: Optional[str] = None) -> Optional[Dict[str, Any]]:
    return repo.get_project(tenant_id=tenant_id, project_id=project_id, employee_code=employee_code)

def delete_project(tenant_id: str, project_id: str, employee_code: Optional[str] = None) -> bool:
    return repo.delete_project(tenant_id=tenant_id, project_id=project_id, employee_code=employee_code)

def add_chat_message(tenant_id: str, project_id: str, doc_type: str, role: str, content: str) -> Dict[str, Any]:
    return repo.add_chat_message(
        tenant_id=tenant_id,
        project_id=project_id,
        doc_type=doc_type,
        role=role,
        content=content
    )

def get_chat_history(tenant_id: str, project_id: str, doc_type: Optional[str] = None) -> List[Dict[str, Any]]:
    return repo.get_chat_messages(tenant_id=tenant_id, project_id=project_id, doc_type=doc_type)
