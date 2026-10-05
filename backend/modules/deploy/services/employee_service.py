from datetime import datetime
import os
import secrets
import shutil
from typing import Optional, Dict, Any, List
from backend.modules.deploy.repositories.employee_repo import EmployeeRepository
from backend.modules.deploy.repositories.asset_repo import AssetRepository
from backend.modules.deploy.repositories.attendance_repo import AttendanceRepository
from backend.modules.deploy.schemas.employee import UpdateEmployeeRequest, OffboardRequest
from backend.modules.deploy.repositories.user_repo import UserRepository
from backend.common.services.email_service import EmailService
from backend.common.utils.name_utils import join_name_parts, split_full_name
from passlib.hash import pbkdf2_sha256
from backend.core.audit import audit_log

class EmployeeService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.repo = EmployeeRepository()
        self.asset_repo = AssetRepository()
        self.attendance_repo = AttendanceRepository()
        self.user_repo = UserRepository()
        self.email_service = EmailService(tenant_id=self.tenant_id)

    def get_all_employees(self):
        return self.repo.get_all_employees_basic(self.tenant_id)

    def get_team_employees(self, manager_code: str):
        return self.repo.get_team_employees(self.tenant_id, manager_code)

    # "pfp" and "photo" are both in use across the app as the doc_type for the
    # profile picture (the /document/{doc_type} permission gate treats "pfp"
    # specifically as the always-public type) — accept both as aliases so
    # either caller resolves to the same column.
    DOCUMENT_COLUMNS = {"photo": "photo_path", "pfp": "photo_path", "cv": "cv_path", "id_proof": "id_proofs", "passbook": "passbook_path"}

    def get_document_path(self, employee_code: str, doc_type: str) -> Optional[str]:
        """Returns the stored path/URL for an employee's photo/cv/id_proof, or None."""
        column = self.DOCUMENT_COLUMNS.get(doc_type)
        if not column:
            return None
        employee = self.repo.get_employee_by_code(employee_code, self.tenant_id)
        if not employee:
            return None
        return employee.get(column)

    def get_employee_full_details(self, employee_code: str):
        employee = self.repo.get_employee_by_code(employee_code, self.tenant_id)
        if not employee:
            return None

        # Legacy/seeded rows may only have the combined `name` column populated,
        # with first/middle/last never split out. Recover them for display so
        # fields like the Request Edits modal don't show a blank current value.
        if not (employee.get('first_name') and employee.get('last_name')):
            parsed_first, parsed_middle, parsed_last = split_full_name(employee.get('name'))
            employee['first_name'] = employee.get('first_name') or parsed_first
            employee['middle_name'] = employee.get('middle_name') or parsed_middle
            employee['last_name'] = employee.get('last_name') or parsed_last

        # Securely generate temporary access URLs for private documents
        from backend.common.services.storage_service import generate_presigned_url
        if employee.get('cv_path'):
            employee['cv_path'] = generate_presigned_url(employee['cv_path'])
        if employee.get('id_proofs'):
            employee['id_proofs'] = generate_presigned_url(employee['id_proofs'])
        if employee.get('passbook_path'):
            employee['passbook_path'] = generate_presigned_url(employee['passbook_path'])

        # Enrich with other data
        employee['skill_matrix'] = self.repo.get_skill_matrix(employee_code, self.tenant_id)
        employee['assets'] = self.asset_repo.get_assets_for_employee(employee_code, self.tenant_id) if hasattr(self.asset_repo, 'get_assets_for_employee') else self.repo.get_assets(employee_code, self.tenant_id)
        # Assuming repo has hr_activity and assessments as defined
        employee['training'] = self.repo.get_hr_activity(employee_code, self.tenant_id)
        
        # New: Quarterly Assessments
        assessments = self.repo.get_assessments(employee_code, self.tenant_id)
        employee['assessments'] = assessments
        
        # Calculate Average Score (optional logic for dashboard usage)
        if assessments:
             total = sum([a['total_score'] for a in assessments if a['status'] == 'Finalized'])
             count = len([a for a in assessments if a['status'] == 'Finalized'])
             employee['average_score'] = round(total / count, 1) if count > 0 else 0
        else:
             employee['average_score'] = 0

        return employee

    def validate_employee_data(self, data: Dict[str, Any]):
        if not data.get('first_name') or not data.get('last_name'):
            raise ValueError("Employee first name and last name are required.")
            
        if data.get('email') and str(data['email']).strip():
            data['email'] = str(data['email']).strip().lower()
            try:
                existing_emp_by_email = self.repo.get_employee_by_email(data['email'], self.tenant_id)
                if existing_emp_by_email and existing_emp_by_email.get('employment_status') != 'Exited':
                    raise ValueError(f"Email ID '{data['email']}' is already in use.")
            except ValueError:
                raise
            except Exception:
                pass
        
        # Validate Role
        valid_roles = ['super_admin', 'org_admin', 'manager', 'employee', 'trainee']
        try:
            options = self.repo.get_dropdown_options(self.tenant_id)
            valid_roles.extend([r.lower() for r in options.get('custom_roles', [])])
        except Exception:
            pass
            
        if data.get('code') and str(data['code']).strip():
            try:
                existing_emp_by_code = self.repo.get_employee_by_code(data['code'], self.tenant_id)
                if existing_emp_by_code:
                    raise ValueError(f"Employee Code '{data['code']}' is already in use.")
            except ValueError:
                raise
            except Exception:
                pass
                
        role = str(data.get('role') or 'employee').strip().lower()
        if role not in valid_roles:
            raise ValueError(f"Role '{role}' does not exist in the system.")
        data['role'] = role

    def create_employee(self, data: Dict[str, Any], actor: str = 'system'):
        # Run validations
        self.validate_employee_data(data)
        
        data['name'] = join_name_parts(data.get('first_name'), data.get('middle_name'), data.get('last_name'))

        # Generate employee code if not provided (single-add path; bulk upload always provides one)
        if not data.get('code'):
            import uuid
            data['code'] = f"EMP{uuid.uuid4().hex[:8].upper()}"
        
        # Set defaults for any missing fields
        data.setdefault('employment_status', 'Active')
        data.setdefault('type', 'Full-time')
        data.setdefault('pf', 'No')
        data.setdefault('mediclaim', 'No')
        data.setdefault('education_details', [])
        data.setdefault('experience_years', 0)
        
        # Create the employee
        self.repo.create_employee(data, self.tenant_id)
        audit_log(self.tenant_id, actor, 'CREATE_EMPLOYEE',
                  f"Created employee {data['name']} ({data['code']}) — Dept: {data.get('department', 'N/A')}, Role: {data.get('designation', 'N/A')}",
                  module='deploy')
    
        # --- ATOMIC INITIALIZATION ---
        # 1. Initialize Asset Checklist (Empty/Default)
        default_assets = {
            'ob_pf': 1 if data.get('pf') in ['Yes', 'true', '1'] else 0,
            'ob_mediclaim': 1 if data.get('mediclaim') in ['Yes', 'true', '1'] else 0
        }
        # Assuming asset_repo can accept tenant_id; if not we ignore or fix asset_repo later
        try:
            self.asset_repo.create_asset_checklist(data['code'], default_assets, self.tenant_id)
        except Exception:
            pass

        # 2. Initialize Leave Balance (Current Year)
        current_year = datetime.now().year
        try:
            self.attendance_repo.create_leave_balance(data['code'], current_year, self.tenant_id)
        except Exception:
            pass

        # 3. Auto-create user account so the employee can log in (only if email is provided)
        username = data.get('email')  # email is the login username
        temp_password = None
        user_created = False
        email_sent = False

        if username:  # Only create user if email exists
            # Only create if this email isn't already a user
            existing_user = None
            try:
                existing_user = self.user_repo.get_user_by_username(username)
            except:
                pass

            if not existing_user:
                emp_status = data.get('employment_status', 'Active')
                if emp_status != 'Exited':
                    # Generate a secure 8-char URL-safe temp password
                    temp_password = secrets.token_urlsafe(8)
                    password_hash = pbkdf2_sha256.hash(temp_password)
                    try:
                        self.user_repo.create_user(
                            username=username,
                            password_hash=password_hash,
                            role=data.get('role') or 'employee',
                            employee_code=data['code'],
                            tenant_id=self.tenant_id,
                            is_active=0 if emp_status == 'Inactive' else 1
                        )
                        user_created = True
        
                        # Send welcome email with credentials (only if Active)
                        if emp_status == 'Active' and self.email_service.is_configured():
                            email_result = self.email_service.send_new_employee_credentials(
                                recipient_email=username,
                                recipient_name=data.get('first_name') or data['name'],
                                employee_code=data['code'],
                                temporary_password=temp_password
                            )
                            email_sent = email_result.get('success', False)
                    except Exception as user_create_err:
                        import logging
                        logging.getLogger(__name__).error(f"Failed to create user account for employee {data.get('code')}: {user_create_err}")
            else:
                # Link existing user to this employee code if not already linked
                if not existing_user.get('employee_code'):
                    from backend.modules.deploy.repositories.admin_repo import AdminRepository
                    admin_repo = AdminRepository()
                    try:
                        admin_repo.update_employee_code(existing_user['id'], data['code'])
                    except:
                        pass

        result = {"success": True, "message": "Employee added successfully!"}
        if user_created:
            result["email_sent"] = email_sent
            if email_sent:
                result["message"] = f"Employee added and login credentials emailed to {username}."
            else:
                result["message"] = "Employee added. Email not configured — share credentials manually."
                result["login_credentials"] = {
                    "username": username,
                    "temporary_password": temp_password,
                    "note": "Share these credentials with the employee. They must change the password on first login."
                }
        elif username and not user_created:
            result["message"] += " An existing user account was found and linked."

        return result

    def update_employee(self, employee_code: str, data: dict):
        print("UPDATE_EMPLOYEE_DATA:", data)
        print("DEBUG DATA RECEIVED:", data)
        allowed_fields = [
            'exit_date', 'exit_reason', 'clearance_status', 'employment_status',
            'name', 'first_name', 'middle_name', 'last_name', 'guardian_name', 'designation', 'team', 'employment_type', 'reporting_manager', 'location',
            'contact_number', 'emergency_contact',
            'emergency_contact_first_name', 'emergency_contact_middle_name', 'emergency_contact_last_name',
            'current_address',
            'permanent_address', 'dob', 'email_id', 'notes', 'doj',
            'photo_path', 'cv_path', 'id_proofs', 'passbook_path', 'pf_included', 'mediclaim_included',
            'education_details', 'employee_code', 'bank_name', 'bank_account_no', 'pan_no', 'ifsc_code'
        ]

        fields = []
        values = []

        # Capture old email to update user username if changed; also used to
        # fill in any name parts the caller didn't send so `name` stays in sync
        old_employee = self.repo.get_employee_by_code(employee_code, self.tenant_id)
        old_email = str(old_employee.get('email_id') or "").strip().lower() if old_employee and old_employee.get('email_id') else None

        if 'email_id' in data and data['email_id'] is not None:
            data['email_id'] = str(data['email_id']).strip().lower()

        if any(k in data for k in ('first_name', 'middle_name', 'last_name')):
            old_first = (old_employee or {}).get('first_name')
            old_middle = (old_employee or {}).get('middle_name')
            old_last = (old_employee or {}).get('last_name')
            # Legacy/seeded rows may only have the combined `name` column populated,
            # with first/middle/last never split out. Falling back straight to those
            # (empty) columns would let editing just one name part wipe the other two
            # out of `name` entirely, so recover the missing parts from `name` first.
            if not (old_first and old_last):
                parsed_first, parsed_middle, parsed_last = split_full_name((old_employee or {}).get('name'))
                old_first = old_first or parsed_first
                old_middle = old_middle or parsed_middle
                old_last = old_last or parsed_last

            first_name = data.get('first_name', old_first)
            middle_name = data.get('middle_name', old_middle)
            last_name = data.get('last_name', old_last)
            data['name'] = join_name_parts(first_name, middle_name, last_name)

        import json
        for key, value in data.items():
            if key not in allowed_fields:
                continue
            # Skip None values, but allow empty strings (user may be clearing a field)
            if value is None:
                continue
            # Skip nested objects that aren't meant for the employees table
            if isinstance(value, (dict, list)) and key != 'education_details':
                continue
            # Handle JSONB fields
            if key == 'education_details' and isinstance(value, (dict, list)):
                value = json.dumps(value)
            
            fields.append(key)
            values.append(value)

        
        if fields:
            self.repo.update_employee_fields(employee_code, fields, values, self.tenant_id)

        # Use NEW employee code for subsequent updates if it was changed
        current_emp_code = data.get('employee_code', employee_code)

        # Synchronize user account active/locked state if employment status is updated
        if 'employment_status' in data and data['employment_status']:
            new_emp_status = data['employment_status']
            old_emp_status = (old_employee or {}).get('employment_status')
            fallback_mail = old_email or data.get('email_id')

            if new_emp_status in ('Inactive', 'Exited', 'Terminated'):
                self.repo.update_user_active_by_employee(
                    employee_code=current_emp_code,
                    is_active=0,
                    tenant_id=self.tenant_id,
                    fallback_email=fallback_mail
                )
            elif new_emp_status in ('Active', 'Notice Period', 'On Leave'):
                if old_emp_status in ('Inactive', 'Exited', 'Terminated'):
                    self.repo.update_user_active_by_employee(
                        employee_code=current_emp_code,
                        is_active=1,
                        tenant_id=self.tenant_id,
                        fallback_email=fallback_mail
                    )

        # Update user role if changed
        if 'role' in data and data['role']:
            self.repo.update_user_role(current_emp_code, data['role'], self.tenant_id)

        # Sync email with user username (only if email_id is provided)
        if 'email_id' in data and data['email_id'] != old_email and data['email_id']:
             try:
                 user = self.user_repo.get_user_by_username(old_email)
                 if user:
                     self.user_repo.update_username(user['id'], data['email_id'])
             except:
                 pass

        # Skills update - prioritize flattened fields from data
        p_skill = data.get('primary_skillset')
        s_skill = data.get('secondary_skillset')
        exp = data.get('experience_years')
        
        # If skills were passed inside a skill_matrix object but NOT at top level, pick them up
        if 'skill_matrix' in data and isinstance(data['skill_matrix'], dict):
             if p_skill is None: p_skill = data['skill_matrix'].get('primary_skillset')
             if s_skill is None: s_skill = data['skill_matrix'].get('secondary_skillset')
             if exp is None: exp = data['skill_matrix'].get('experience_years')
             
        if p_skill is not None or s_skill is not None or exp is not None:
            self.repo.update_skill_matrix(current_emp_code, p_skill, s_skill, self.tenant_id, experience_years=exp)

        # Sync PF and Mediclaim to Assets Table
        asset_fields = []
        asset_values = []
        if 'pf_included' in fields:
            idx = fields.index('pf_included')
            val = values[idx]
            asset_fields.append('ob_pf')
            asset_values.append(1 if str(val).lower() in ['yes', 'true', '1'] else 0)
        if 'mediclaim_included' in fields:
            idx = fields.index('mediclaim_included')
            val = values[idx]
            asset_fields.append('ob_mediclaim')
            asset_values.append(1 if str(val).lower() in ['yes', 'true', '1'] else 0)
            
        if asset_fields:
            try:
                from backend.modules.deploy.repositories.asset_repo import AssetRepository
                AssetRepository().update_asset_fields(current_emp_code, asset_fields, asset_values, self.tenant_id)
            except Exception as e:
                print("Failed to sync assets:", e)

        return {"success": True, "message": "Employee updated successfully"}
    
    def delete_employee(self, employee_code: str, actor: str = 'system'):
        emp = self.repo.get_employee_by_code(employee_code, self.tenant_id)
        if not emp:
             raise ValueError("Employee not found")
        
        self.repo.delete_employee_cascade(employee_code, self.tenant_id)
        audit_log(self.tenant_id, actor, 'DELETE_EMPLOYEE',
                  f"Deleted employee record {employee_code} ({emp.get('name', '')})",
                  module='deploy')
        return {"success": True, "message": f"Employee {employee_code} deleted successfully"}

    def get_options(self):
        return self.repo.get_dropdown_options(self.tenant_id)

    def offboard_employee(self, employee_code: str, req: OffboardRequest, actor: str = 'system'):
         exit_date = req.exit_date or datetime.today().strftime('%Y-%m-%d')
         
         # Combine Reason and Remarks
         full_reason = req.exit_reason or 'Resignation'
         if req.remarks:
             full_reason += f" | Notes: {req.remarks}"
             
         # Logic for Status
         status = 'Exited'
         deactivate = True
         
         if req.exit_type == 'Notice Period':
             status = 'Notice Period'
             deactivate = False
             
         self.repo.offboard_employee(employee_code, exit_date, full_reason, status=status, deactivate=deactivate, tenant_id=self.tenant_id)
         
         if status == 'Exited':
             try:
                 from backend.core.email_service_extended import send_relieving_letter_email
                 emp = self.repo.get_employee_by_code(employee_code, self.tenant_id)
                 if emp and (emp.get('email_id') or emp.get('email')):
                     recipient = emp.get('email_id') or emp.get('email')
                     send_relieving_letter_email(
                         to_email=recipient,
                         employee_name=emp.get('name', employee_code),
                         company_name=self.email_service.company_name,
                         last_working_day=str(exit_date),
                         designation=emp.get('designation', 'Team Member')
                     )
             except Exception as ex_mail:
                 import logging
                 logging.getLogger(__name__).warning(f"Failed to send relieving letter email: {ex_mail}")

         audit_log(self.tenant_id, actor, 'OFFBOARD_EMPLOYEE',
                   f"Employee {employee_code} offboarded — Status: {status}, Reason: {full_reason[:80]}",
                   module='deploy')
         return {"success": True, "message": f"Employee {employee_code} marked as {status}."}