from typing import Dict, Any, List, Optional
from backend.modules.deploy.repositories.profile_edit_request_repo import ProfileEditRequestRepository
from backend.modules.deploy.repositories.employee_repo import EmployeeRepository
from backend.modules.deploy.services.notification_service import add_notification

# Fields an employee may propose a change for via the self-service request flow.
# Job/org-structure fields (designation, team, reporting manager, employment type,
# DOJ) are deliberately excluded — those changes are HR-initiated, not requested.
TEXT_FIELDS = {
    'first_name': 'First Name',
    'middle_name': 'Middle Name',
    'last_name': 'Last Name',
    'dob': 'Date of Birth',
    'contact_number': 'Contact Number',
    'emergency_contact_first_name': 'Emergency Contact First Name',
    'emergency_contact_middle_name': 'Emergency Contact Middle Name',
    'emergency_contact_last_name': 'Emergency Contact Last Name',
    'emergency_contact': 'Emergency Contact Number',
    'current_address': 'Current Address',
    'permanent_address': 'Permanent Address',
    'email_id': 'Email',
    'bank_name': 'Bank Name',
    'bank_account_no': 'Bank Account No.',
    'pan_no': 'PAN No.',
    'ifsc_code': 'IFSC Code',
    'primary_skillset': 'Primary Skillset',
    'secondary_skillset': 'Secondary Skillset',
}

# Document fields route through the same request-for-review flow rather than
# an instant upload. Maps request key -> (label, employees column, storage data_type).
DOCUMENT_FIELDS = {
    'photo_path': ('Photo', 'photo_path', 'pfp'),
    'cv_path': ('Resume / CV', 'cv_path', 'resume'),
    'id_proofs': ('ID Proof', 'id_proofs', 'identification_docs'),
    'passbook_path': ('Bank Passbook', 'passbook_path', 'passbook'),
}


class ProfileEditRequestService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = ProfileEditRequestRepository()
        self.employee_repo = EmployeeRepository()
        self.tenant_id = tenant_id

    def submit_request(
        self,
        employee_code: str,
        field_values: Dict[str, str],
        doc_files: Dict[str, Any],
        supporting_files: List[Any],
        notes: Optional[str],
    ) -> Dict[str, Any]:
        employee = self.employee_repo.get_employee_by_code(employee_code, self.tenant_id)
        if not employee:
            raise ValueError("Employee not found")

        existing_pending = self.repo.get_pending_request(employee_code, self.tenant_id)
        if existing_pending:
            raise ValueError("You already have an edit request pending review. Please wait for it to be reviewed before submitting another.")

        unknown_fields = set(field_values.keys()) - set(TEXT_FIELDS.keys())
        if unknown_fields:
            raise ValueError(f"These fields cannot be requested for edit: {', '.join(sorted(unknown_fields))}")

        unknown_docs = set(doc_files.keys()) - set(DOCUMENT_FIELDS.keys())
        if unknown_docs:
            raise ValueError(f"Unrecognized document field(s): {', '.join(sorted(unknown_docs))}")

        if not field_values and not doc_files:
            raise ValueError("Select at least one field to edit.")

        if not any(upload and getattr(upload, 'filename', None) for upload in (supporting_files or [])):
            raise ValueError("Attach at least one supporting document as proof.")

        skill_matrix = self.employee_repo.get_skill_matrix(employee_code, self.tenant_id) or {}

        requested_fields = []
        for field, new_value in field_values.items():
            if not str(new_value or '').strip():
                continue
            if field in ('primary_skillset', 'secondary_skillset'):
                old_value = skill_matrix.get(field, '')
            else:
                old_value = employee.get(field, '')
            if str(new_value).strip().lower() == str(old_value or '').strip().lower():
                raise ValueError(f"{TEXT_FIELDS[field]} can't be same as old one")
            requested_fields.append({
                'field': field,
                'label': TEXT_FIELDS[field],
                'old_value': old_value or '',
                'new_value': new_value,
            })

        from backend.common.services.storage_service import save_uploaded_file
        import uuid
        batch_id = uuid.uuid4().hex[:8]

        for doc_key, upload in doc_files.items():
            if not upload or not getattr(upload, 'filename', None):
                continue
            label, employee_column, data_type = DOCUMENT_FIELDS[doc_key]
            saved_path = save_uploaded_file(upload, self.tenant_id, 'deploy', data_type, f"{employee_code}_req_{batch_id}", doc_key)
            requested_fields.append({
                'field': doc_key,
                'label': label,
                'old_value': employee.get(employee_column) or '',
                'new_value': saved_path,
                'is_document': True,
            })

        if not requested_fields:
            raise ValueError("Select at least one field to edit and provide a new value.")

        supporting_docs = []
        for idx, upload in enumerate(supporting_files or []):
            if not upload or not getattr(upload, 'filename', None):
                continue
            saved_path = save_uploaded_file(upload, self.tenant_id, 'deploy', 'edit_request_support', f"{employee_code}_req_{batch_id}", f"support{idx + 1}")
            supporting_docs.append({'label': upload.filename, 'path': saved_path})

        request_id = self.repo.create_request(employee_code, requested_fields, supporting_docs, notes, self.tenant_id)

        field_summary = ', '.join(f['label'] for f in requested_fields)
        add_notification(
            title="Edit Request Submitted",
            message=f"Your request to update {field_summary} has been sent for review. Your profile stays unchanged until it's approved.",
            employee_code=employee_code,
            n_type="Info",
            tenant_id=self.tenant_id
        )
        add_notification(
            title="Profile Edit Request Pending",
            message=f"{employee.get('name', employee_code)} ({employee_code}) requested changes to: {field_summary}.",
            n_type="AdminAlert",
            tenant_id=self.tenant_id
        )

        return {"success": True, "message": "Your changes have been sent for review.", "request_id": request_id}

    def get_pending_request(self, employee_code: str) -> Optional[Dict[str, Any]]:
        return self.repo.get_pending_request(employee_code, self.tenant_id)

    def get_latest_unacknowledged_decision(self, employee_code: str) -> Optional[Dict[str, Any]]:
        return self.repo.get_latest_unacknowledged_decision(employee_code, self.tenant_id)

    def acknowledge_request(self, request_id: int, employee_code: str) -> Dict[str, Any]:
        req = self.get_request_by_id(request_id)
        if not req or req['employee_code'] != employee_code:
            raise ValueError("Edit request not found")
        self.repo.acknowledge_request(request_id, self.tenant_id)
        return {"success": True}

    def list_pending_requests(self) -> List[Dict[str, Any]]:
        return self.repo.get_pending_requests(self.tenant_id)

    def get_request_by_id(self, request_id: int) -> Optional[Dict[str, Any]]:
        return self.repo.get_request_by_id(request_id, self.tenant_id)

    def resolve_document_path(self, request_id: int, source: str, key: str) -> Optional[str]:
        """Looks up the on-disk/S3 path for a document tied to a specific
        request — either one of its requested document-field changes ('field',
        field key) or one of its supporting proof uploads ('support', index)."""
        req = self.get_request_by_id(request_id)
        if not req:
            return None
        if source == 'field':
            match = next((f for f in (req.get('requested_fields') or []) if f.get('field') == key and f.get('is_document')), None)
            return match.get('new_value') if match else None
        if source == 'support':
            try:
                idx = int(key)
            except ValueError:
                return None
            docs = req.get('supporting_docs') or []
            if idx < 0 or idx >= len(docs):
                return None
            return docs[idx].get('path')
        return None

    def review_request(self, request_id: int, decision: str, reviewer: str, review_notes: Optional[str] = None) -> Dict[str, Any]:
        if decision not in ('approve', 'reject'):
            raise ValueError("Decision must be 'approve' or 'reject'")

        req = self.get_request_by_id(request_id)
        if not req:
            raise ValueError("Edit request not found")
        if req['status'] != 'Pending':
            raise ValueError("This request has already been reviewed")

        employee_code = req['employee_code']

        if decision == 'approve':
            # Requested fields double as the update payload — text fields map
            # straight onto EmployeeService's allowed fields (which itself
            # knows to route primary/secondary skillset into skill_matrix),
            # and document fields just point the employees row at the file
            # that was already uploaded and saved when the request was submitted.
            payload = {f['field']: f['new_value'] for f in (req.get('requested_fields') or [])}
            from backend.modules.deploy.services.employee_service import EmployeeService
            EmployeeService(tenant_id=self.tenant_id).update_employee(employee_code, payload)
            new_status = 'Approved'
            notif_title = "Edit Request Approved"
            notif_message = "Your requested profile changes have been approved and are now live on your profile."
            notif_type = "Success"
        else:
            new_status = 'Rejected'
            notif_title = "Edit Request Rejected"
            notif_message = "Your requested profile changes were not approved."
            if review_notes:
                notif_message += f" Reason: {review_notes}"
            notif_type = "Alert"

        self.repo.update_status(request_id, new_status, reviewer, review_notes, self.tenant_id)

        add_notification(
            title=notif_title,
            message=notif_message,
            employee_code=employee_code,
            n_type=notif_type,
            tenant_id=self.tenant_id
        )

        return {"success": True, "status": new_status}
